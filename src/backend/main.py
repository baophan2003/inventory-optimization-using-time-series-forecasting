import logging
import math
import sys
from datetime import timedelta

import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scipy.stats import norm
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.StreamHandler(sys.stdout)])

logger = logging.getLogger(__name__)

app = FastAPI()

ROLLING_WINDOW_DAYS = 90

DATABASE_URL = "postgresql://user:password@host:port/database"
LOAD_FROM_DB = False

def load_data_from_db(db_url: str) -> pd.DataFrame:
    logger.info("Attempting to load data from database...")
    try:
        logger.warning("Database loading not fully implemented. Returning empty DataFrame.")
        return pd.DataFrame()
    except Exception as e:
        logger.error(f"Database connection or query failed: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Could not connect to or query the database: {e}")

def load_data_from_csv(filepath="retail_store_inventory.csv") -> pd.DataFrame:
    logger.info(f"Loading data from CSV: {filepath}")
    try:
        df = pd.read_csv(filepath, parse_dates=["Date"])
        numeric_cols = ["Inventory Level", "Units Sold", "Units Ordered", "Demand Forecast", "Price", "Discount", "Competitor Pricing"]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df = df.sort_values(by="Date")
        logger.info(f"Successfully loaded {len(df)} rows from CSV.")
        return df
    except FileNotFoundError:
        logger.error(f"CSV file not found: {filepath}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Source data file not found: {filepath}")
    except Exception as e:
        logger.error(f"Error loading or processing CSV '{filepath}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing source data file.")

try:
    if LOAD_FROM_DB:
        df = load_data_from_db(DATABASE_URL)
    else:
        df = load_data_from_csv()
except HTTPException as e:
    logger.critical(f"CRITICAL: Data loading failed: {e.detail}. Application might not function correctly.")
    df = pd.DataFrame()

ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_product_data(product_id: str):
    if df.empty:
        logger.warning("Attempted operation with empty DataFrame.")
        raise HTTPException(status_code=503, detail="Inventory data is currently unavailable.")

    product_data = df[df["Product ID"] == product_id].copy()
    if product_data.empty:
        raise HTTPException(status_code=404, detail=f"Product ID '{product_id}' not found in dataset.")

    product_data.dropna(subset=['Units Sold'], inplace=True)
    if product_data.empty:
        raise HTTPException(status_code=400, detail=f"Product ID '{product_id}' has no valid 'Units Sold' data for processing.")

    ts_data = product_data.set_index("Date")["Units Sold"].resample('D').sum().fillna(0)

    return product_data, ts_data

def forecast_demand(ts_data: pd.Series, model_type="ARIMA", forecast_days: int = 30, seasonal_periods: int = 7):
    min_data_points = max(10, 2 * seasonal_periods if model_type=="ExponentialSmoothing" else 10)
    if len(ts_data) < min_data_points:
          raise HTTPException(status_code=400, detail=f"Insufficient historical data ({len(ts_data)} points) for {model_type}. Need at least {min_data_points}.")

    if forecast_days <= 0:
        raise HTTPException(status_code=400, detail="Forecast days must be a positive integer.")
    if seasonal_periods <= 1 and model_type == "ExponentialSmoothing":
          logger.warning("Exponential Smoothing called with seasonal_periods <= 1. Fitting non-seasonal or potentially failing.")
          pass

    try:
        logger.info(f"Fitting {model_type} model for {forecast_days} days (Seasonality: {seasonal_periods if model_type=='ExponentialSmoothing' else 'N/A'})...")
        if model_type == "ARIMA":
            model = ARIMA(ts_data, order=(5,1,0))
            model_fit = model.fit()
            forecast = model_fit.forecast(steps=forecast_days)
        elif model_type == "ExponentialSmoothing":
            try:
                model = ExponentialSmoothing(ts_data, trend="add", seasonal="add", seasonal_periods=seasonal_periods, initialization_method='estimated')
                model_fit = model.fit()
                forecast = model_fit.forecast(steps=forecast_days)
            except ValueError as ve:
                logger.error(f"ValueError during Exponential Smoothing fitting: {ve}", exc_info=True)
                raise HTTPException(status_code=400, detail=f"Could not fit Exponential Smoothing model, possibly due to insufficient data for seasonality={seasonal_periods}. Error: {ve}")
        else:
            raise HTTPException(status_code=400, detail=f"Invalid model type specified: {model_type}")

        forecast[forecast < 0] = 0
        logger.info(f"{model_type} model fitting complete.")
        return forecast.round().tolist()

    except Exception as e:
        logger.error(f"Error during {model_type} forecasting (Days: {forecast_days}, Season: {seasonal_periods}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal error occurred during {model_type} forecasting. Please check server logs.")


def calculate_inventory_optimization(
    product_id: str,
    forecast_values: List[float],
    lead_time_days: int,
    service_level: float,
    holding_cost_per_unit_per_year: float,
    ordering_cost_per_order: float
):
    try:
        product_hist_data, _ = get_product_data(product_id)

        daily_sales = product_hist_data.set_index("Date")["Units Sold"].resample('D').sum()

        if len(daily_sales) >= ROLLING_WINDOW_DAYS:
            std_dev_demand = daily_sales.rolling(window=ROLLING_WINDOW_DAYS).std().iloc[-1]
            variability_method = f"{ROLLING_WINDOW_DAYS}-Day Rolling Std Dev"
        elif len(daily_sales) >= 2:
            logger.warning(f"Product {product_id}: Insufficient data ({len(daily_sales)} days) for {ROLLING_WINDOW_DAYS}-day rolling std dev. Using overall std dev.")
            std_dev_demand = daily_sales.std(skipna=True)
            variability_method = "Overall Std Dev (Insufficient Rolling Data)"
        else:
            std_dev_demand = 0
            variability_method = "N/A (Insufficient Data)"

        std_dev_demand = 0 if pd.isna(std_dev_demand) else std_dev_demand
        logger.info(f"Product {product_id}: Calculated Std Dev Demand = {std_dev_demand:.2f} (Method: {variability_method})")

        z_score = norm.ppf(service_level)

        safety_stock = z_score * math.sqrt(lead_time_days) * std_dev_demand
        safety_stock = math.ceil(safety_stock) if safety_stock > 0 else 0

        actual_lead_time_forecast_days = min(len(forecast_values), lead_time_days)
        if actual_lead_time_forecast_days < lead_time_days:
            logger.warning(f"Product {product_id}: Forecast horizon ({len(forecast_values)} days) is shorter than lead time ({lead_time_days} days). DDLT calculation uses available {actual_lead_time_forecast_days} days.")
        ddlt = sum(forecast_values[:actual_lead_time_forecast_days])
        ddlt = math.ceil(ddlt)

        reorder_point = ddlt + safety_stock

        if len(forecast_values) > 0:
            avg_forecasted_daily_demand = sum(forecast_values) / len(forecast_values)
            annual_demand = avg_forecasted_daily_demand * 365
            annual_demand_method = "Forecasted Average"
            logger.info(f"Product {product_id}: Estimated Annual Demand from forecast = {annual_demand:.2f} (Avg Daily: {avg_forecasted_daily_demand:.2f})")
        else:
            logger.warning(f"Product {product_id}: Cannot estimate annual demand from empty forecast. EOQ will be 0.")
            annual_demand = 0
            annual_demand_method = "N/A (Empty Forecast)"

        if annual_demand <= 0 or holding_cost_per_unit_per_year <= 0 or ordering_cost_per_order < 0:
            eoq = 0
        else:
            eoq_raw = math.sqrt((2 * annual_demand * ordering_cost_per_order) / holding_cost_per_unit_per_year)
            eoq = math.ceil(eoq_raw)
            logger.info(f"Product {product_id}: Calculated EOQ = {eoq} (Raw: {eoq_raw:.2f})")

        if product_hist_data.empty:
            current_inventory = 0
            logger.warning(f"Product {product_id}: No historical data found to determine current inventory. Assuming 0.")
        else:
            latest_entry = product_hist_data.iloc[-1]
            current_inventory = latest_entry['Inventory Level']
            if pd.isna(current_inventory):
                current_inventory = 0
                logger.warning(f"Product {product_id}: Latest inventory level is missing. Assuming 0.")
            else:
                 current_inventory = int(current_inventory)

        suggestion = "Maintain current stock."
        if current_inventory <= reorder_point:
            order_qty = eoq if eoq > 0 else (reorder_point + safety_stock - current_inventory)
            order_qty = max(0, math.ceil(order_qty))
            if order_qty > 0:
                 suggestion = f"Order {order_qty} units (Current: {current_inventory}, ROP: {reorder_point})."
            else:
                 suggestion = "Maintain current stock (Consider reviewing EOQ parameters)."
        elif current_inventory > reorder_point + (eoq if eoq > 0 else safety_stock):
             suggestion = f"Potential overstock (Current: {current_inventory}, ROP: {reorder_point}, SS: {safety_stock})."

        return {
            "product_id": product_id,
            "current_inventory": current_inventory,
            "safety_stock": int(safety_stock),
            "reorder_point": int(reorder_point),
            "economic_order_quantity": int(eoq),
            "demand_during_lead_time": int(ddlt),
            "suggestion": suggestion,
            "assumptions_used": {
                 "lead_time_days": lead_time_days,
                 "service_level_percent": round(service_level * 100, 2),
                 "holding_cost_per_unit_per_year": holding_cost_per_unit_per_year,
                 "ordering_cost_per_order": ordering_cost_per_order,
                 "demand_variability_method": variability_method,
                 "annual_demand_method": annual_demand_method
            }
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error in calculate_inventory_optimization for {product_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal error occurred while calculating optimization metrics: {e}")


@app.get("/products")
def get_product_ids():
    logger.info("Request received for /products")
    if df.empty:
        logger.warning("/products requested but data is unavailable.")
        raise HTTPException(status_code=503, detail="Inventory data is currently unavailable.")
    try:
        product_ids = df["Product ID"].dropna().unique().tolist()
        logger.info(f"Returning {len(product_ids)} unique product IDs.")
        return {"products": product_ids}
    except Exception as e:
        logger.error(f"Error retrieving product IDs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while retrieving product IDs.")


@app.get("/forecast/{product_id}")
def get_forecast(
    product_id: str,
    model_type: str = Query("ARIMA", enum=["ARIMA", "ExponentialSmoothing"]),
    forecast_days: int = Query(30, gt=0, description="Number of days to forecast ahead"),
    seasonal_periods: int = Query(7, gt=1, description="Seasonal periods for Exponential Smoothing (e.g., 7 for weekly)")
):
    logger.info(f"Request received for /forecast/{product_id} (Model: {model_type}, Days: {forecast_days}, Season: {seasonal_periods})")
    try:
        _, ts_data = get_product_data(product_id)
        forecast = forecast_demand(
            ts_data,
            model_type=model_type,
            forecast_days=forecast_days,
            seasonal_periods=seasonal_periods
        )
        logger.info(f"Forecast generated successfully for {product_id}.")
        return {
            "product_id": product_id,
            "model_type": model_type,
            "forecast_days": forecast_days,
            "seasonal_periods_used": seasonal_periods if model_type == "ExponentialSmoothing" else None,
            "forecast": forecast
          }
    except HTTPException as http_exc:
        logger.warning(f"HTTP Exception during forecast for {product_id}: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error in get_forecast endpoint for {product_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while generating the forecast.")


@app.get("/optimize/{product_id}")
def get_optimization_metrics(
    product_id: str,
    model_type: str = Query("ARIMA", enum=["ARIMA", "ExponentialSmoothing"]),
    lead_time_days: int = Query(7, gt=0, description="Lead time in days"),
    service_level: float = Query(0.95, ge=0.0, le=1.0, description="Target service level (0.0 to 1.0)"),
    holding_cost: float = Query(1.50, ge=0.0, description="Annual holding cost per unit"),
    ordering_cost: float = Query(50.00, ge=0.0, description="Cost per order placed"),
    forecast_days: int = Query(30, gt=0, description="Number of days forecast used"),
    seasonal_periods: int = Query(7, gt=1, description="Seasonal periods used for Exp. Smoothing forecast")
):
    logger.info(f"Request received for /optimize/{product_id} (Model: {model_type}, Days: {forecast_days}, Season: {seasonal_periods}, LeadTime: {lead_time_days}, SL: {service_level}, HC: {holding_cost}, OC: {ordering_cost})")
    try:
        _, ts_data = get_product_data(product_id)

        forecast_values = forecast_demand(
            ts_data,
            model_type=model_type,
            forecast_days=forecast_days,
            seasonal_periods=seasonal_periods
        )
        logger.info(f"Forecast obtained for optimization calculation for {product_id}.")

        optimization_data = calculate_inventory_optimization(
            product_id=product_id,
            forecast_values=forecast_values,
            lead_time_days=lead_time_days,
            service_level=service_level,
            holding_cost_per_unit_per_year=holding_cost,
            ordering_cost_per_order=ordering_cost
        )

        optimization_data["model_type_used"] = model_type
        optimization_data["forecast_days_used"] = forecast_days
        optimization_data["seasonal_periods_used"] = seasonal_periods if model_type == "ExponentialSmoothing" else None

        logger.info(f"Optimization metrics calculated successfully for {product_id}.")
        return optimization_data

    except HTTPException as http_exc:
          logger.warning(f"HTTP Exception during optimization for {product_id}: {http_exc.status_code} - {http_exc.detail}")
          raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error in get_optimization_metrics endpoint for {product_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while calculating optimization metrics.")

class InventoryRecord(BaseModel):
    date: str
    inventoryLevel: int | None
    unitsSold: int | None

@app.get("/inventory/{product_id}", response_model=List[InventoryRecord])
def get_historical_inventory(product_id: str):
    logger.info(f"Request received for /inventory/{product_id}")
    try:
        product_data, _ = get_product_data(product_id)

        hist_data = product_data[["Date", "Inventory Level", "Units Sold"]].copy()

        hist_data["Date"] = hist_data["Date"].dt.strftime('%Y-%m-%d')

        hist_data.rename(columns={"Inventory Level": "inventoryLevel", "Units Sold": "unitsSold", "Date": "date"}, inplace=True)

        hist_data = hist_data.replace({np.nan: None})

        result = hist_data.to_dict(orient='records')
        logger.info(f"Returning {len(result)} historical records for {product_id}.")
        return result

    except HTTPException as http_exc:
        logger.warning(f"HTTP Exception during historical inventory fetch for {product_id}: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error in get_historical_inventory for {product_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while retrieving historical inventory data.")

if __name__ == "__main__":
    logger.info("Starting FastAPI server using uvicorn...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, log_level="info")