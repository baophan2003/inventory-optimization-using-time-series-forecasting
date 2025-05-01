import React, { useState, useEffect, useRef } from "react";
import Chart from "../components/Chart";
import InventoryTable from "../components/InventoryTable";
import OptimizationDisplay from "../components/OptimizationDisplay";
import AssumptionsInput from "../components/AssumptionsInput";

const Dashboard = () => {
    const [forecast, setForecast] = useState([]);
    const [optimizationData, setOptimizationData] = useState(null);
    const [productIds, setProductIds] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedModelType, setSelectedModelType] = useState("ARIMA");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDebouncing, setIsDebouncing] = useState(false);

    const [forecastDays, setForecastDays] = useState(30);
    const [seasonalPeriods, setSeasonalPeriods] = useState(7);
    const [assumptions, setAssumptions] = useState({
        leadTime: 7,
        serviceLevel: 95,
        holdingCost: 1.50,
        orderingCost: 50.00,
    });

    const [debouncedForecastDays, setDebouncedForecastDays] = useState(forecastDays);
    const [debouncedSeasonalPeriods, setDebouncedSeasonalPeriods] = useState(seasonalPeriods);
    const [debouncedAssumptions, setDebouncedAssumptions] = useState(assumptions);

    const debounceTimerRef = useRef(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetch("http://localhost:8000/products")
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.detail || `HTTP ${response.status}`) })
                        .catch(() => { throw new Error(`HTTP ${response.status}`) });
                }
                return response.json();
            })
            .then(data => {
                if (data.products && data.products.length > 0) {
                    setProductIds(data.products);
                    if (!selectedProductId) {
                        setSelectedProductId(data.products[0]);
                    }
                } else {
                    setError("No products found in the data source.");
                    setIsLoading(false);
                }
            })
            .catch(error => {
                console.error("Error fetching product IDs:", error);
                setError(`Error loading products: ${error.message}`);
                setIsLoading(false);
            });
    }, [selectedProductId]);

    useEffect(() => {

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        const hasInputChanged = forecastDays !== debouncedForecastDays ||
            seasonalPeriods !== debouncedSeasonalPeriods ||
            JSON.stringify(assumptions) !== JSON.stringify(debouncedAssumptions);

        if (hasInputChanged) {
            setIsDebouncing(true);
        } else {
            setIsDebouncing(false);
        }


        debounceTimerRef.current = setTimeout(() => {
            setDebouncedForecastDays(forecastDays);
            setDebouncedSeasonalPeriods(seasonalPeriods);
            setDebouncedAssumptions(assumptions);
            setIsDebouncing(false);
            debounceTimerRef.current = null;
        }, 3000);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [forecastDays, seasonalPeriods, assumptions, debouncedForecastDays, debouncedSeasonalPeriods, debouncedAssumptions]);

    useEffect(() => {
        if (!selectedProductId) {
            if (productIds.length > 0) setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const forecastUrl = `http://localhost:8000/forecast/${selectedProductId}?model_type=${selectedModelType}&forecast_days=${debouncedForecastDays}&seasonal_periods=${debouncedSeasonalPeriods}`;

        const serviceLevelDecimal = debouncedAssumptions.serviceLevel / 100;

        const optimizationUrl = `http://localhost:8000/optimize/${selectedProductId}?model_type=${selectedModelType}&lead_time_days=${debouncedAssumptions.leadTime}&service_level=${serviceLevelDecimal}&holding_cost=${debouncedAssumptions.holdingCost}&ordering_cost=${debouncedAssumptions.orderingCost}&forecast_days=${debouncedForecastDays}&seasonal_periods=${debouncedSeasonalPeriods}`;

        const fetchForecast = fetch(forecastUrl);
        const fetchOptimization = fetch(optimizationUrl);

        Promise.all([fetchForecast, fetchOptimization])
            .then(async ([forecastResponse, optimizationResponse]) => {
                if (!forecastResponse.ok) {
                    const err = await forecastResponse.json().catch(() => ({ detail: `HTTP ${forecastResponse.status}` }));
                    throw new Error(`Forecast Error: ${err.detail || forecastResponse.statusText}`);
                }
                if (!optimizationResponse.ok) {
                    const err = await optimizationResponse.json().catch(() => ({ detail: `HTTP ${optimizationResponse.status}` }));
                    throw new Error(`Optimization Error: ${err.detail || optimizationResponse.statusText}`);
                }

                const forecastData = await forecastResponse.json();
                const optimizationJsonData = await optimizationResponse.json();

                setForecast(forecastData.forecast || []);
                setOptimizationData(optimizationJsonData);
            })
            .catch(error => {
                console.error("Error fetching data:", error);
                setError(`Failed to load data: ${error.message}`);
                setForecast([]);
                setOptimizationData(null);
            })
            .finally(() => {
                setIsLoading(false);
                setIsDebouncing(false);
            });

    }, [selectedProductId, selectedModelType, debouncedForecastDays, debouncedSeasonalPeriods, debouncedAssumptions, productIds.length]);

    const handleModelChange = (event) => {
        setSelectedModelType(event.target.value);
    };

    const handleAssumptionChange = (event) => {
        const { name, value } = event.target;
        const numericValue = value === '' ? '' : Number(value);

        if (value === '' || !isNaN(numericValue)) {
            if (name === 'serviceLevel' && (numericValue < 0 || numericValue > 100)) return;
            if (name === 'leadTime' && numericValue !== '' && (!Number.isInteger(numericValue) || numericValue <= 0)) return;
            if ((name === 'holdingCost' || name === 'orderingCost') && numericValue < 0) return;

            setAssumptions(prevAssumptions => ({
                ...prevAssumptions,
                [name]: numericValue
            }));
        }
    };

    const handleForecastDaysChange = (event) => {
        const value = event.target.value;
        const intValue = value === '' ? '' : parseInt(value, 10);
        if (value === '' || (Number.isInteger(intValue) && intValue > 0)) {
            setForecastDays(intValue);
        }
    };

    const handleSeasonalPeriodsChange = (event) => {
        const value = event.target.value;
        const intValue = value === '' ? '' : parseInt(value, 10);
        if (value === '' || (Number.isInteger(intValue) && intValue > 1)) {
            setSeasonalPeriods(intValue);
        }
    };


    const inputRowStyle = { display: 'flex', alignItems: 'center', marginBottom: '15px', minHeight: '30px' };
    const labelStyle = { marginRight: '10px', minWidth: '110px', textAlign: 'right', display: 'inline-block' };
    const settingsBoxStyle = { border: '1px solid #ddd', padding: '15px 20px', borderRadius: '5px', backgroundColor: '#fafafa', minWidth: '350px' };
    const controlsContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '30px', marginBottom: '30px', flexWrap: 'wrap' };
    const loadingIndicatorStyle = { color: '#cc7a00', fontStyle: 'italic', marginLeft: '10px', fontSize: '0.9em' };


    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{ textAlign: 'center' }}> Inventory Optimization Dashboard</h1>

            <div style={controlsContainerStyle}>

                <div style={settingsBoxStyle}>
                    <h4>Product & Forecast Settings</h4>
                    <div style={inputRowStyle}>
                        <label htmlFor="productSelect" style={labelStyle}>Product ID:</label>
                        <select
                            id="productSelect"
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            disabled={isLoading || !productIds.length}
                            style={{ minWidth: '150px', padding: '5px' }}
                        >
                            <option value="" disabled>-- Select --</option>
                            {productIds.map(id => (<option key={id} value={id}>{id}</option>))}
                        </select>
                    </div>
                    <div style={inputRowStyle}>
                        <span style={labelStyle}>Forecast Model:</span>
                        <label style={{ marginRight: '10px', cursor: 'pointer' }}>
                            <input type="radio" value="ARIMA" checked={selectedModelType === "ARIMA"} onChange={handleModelChange} disabled={isLoading} /> ARIMA
                        </label>
                        <label style={{ cursor: 'pointer' }}>
                            <input type="radio" value="ExponentialSmoothing" checked={selectedModelType === "ExponentialSmoothing"} onChange={handleModelChange} disabled={isLoading} /> Exp. Smoothing
                        </label>
                    </div>
                    <div style={inputRowStyle}>
                        <label htmlFor="forecastDays" style={labelStyle}>Forecast Days:</label>
                        <input
                            type="number"
                            id="forecastDays"
                            name="forecastDays"
                            value={forecastDays}
                            onChange={handleForecastDaysChange}
                            disabled={isLoading}
                            min="1"
                            step="1"
                            style={{ width: '80px', padding: '5px' }}
                        />
                        {isDebouncing && debouncedForecastDays !== forecastDays && <span style={loadingIndicatorStyle}>Updating...</span>}
                    </div>
                    {selectedModelType === 'ExponentialSmoothing' && (
                        <div style={inputRowStyle}>
                            <label htmlFor="seasonalPeriods" style={labelStyle}>Seasonal Periods:</label>
                            <input
                                type="number"
                                id="seasonalPeriods"
                                name="seasonalPeriods"
                                value={seasonalPeriods}
                                onChange={handleSeasonalPeriodsChange}
                                disabled={isLoading}
                                min="2"
                                step="1"
                                style={{ width: '80px', padding: '5px' }}
                            />
                            {isDebouncing && debouncedSeasonalPeriods !== seasonalPeriods && <span style={loadingIndicatorStyle}>Updating...</span>}
                        </div>
                    )}
                </div>

                <AssumptionsInput
                    assumptions={assumptions}
                    onAssumptionChange={handleAssumptionChange}
                    disabled={isLoading}
                    isDebouncing={isDebouncing}
                    debouncedAssumptions={debouncedAssumptions}
                />
            </div>


            <div style={{ textAlign: 'center', minHeight: '30px', marginBottom: '20px', fontStyle: 'italic' }}>
                {isLoading && <p>Loading results...</p>}
                {!isLoading && isDebouncing && <p style={{ color: '#cc7a00' }}>Input changed, updating results shortly...</p>}
                {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}
            </div>


            {!selectedProductId && !isLoading && !error && <p style={{ textAlign: 'center' }}>Please select a Product ID to view data.</p>}

            {selectedProductId && !isLoading && !error && (
                <>
                    {optimizationData ? (
                        <OptimizationDisplay
                            data={optimizationData}
                            modelType={selectedModelType}
                            inputAssumptions={debouncedAssumptions}
                        />
                    ) : (
                        <p style={{ textAlign: 'center' }}>Optimization data could not be loaded.</p>
                    )}

                    <h2 style={{ textAlign: 'center', marginTop: '30px' }}>
                        {optimizationData?.forecast_days_used || debouncedForecastDays}-Day Demand Forecast ({selectedModelType})
                    </h2>
                    {forecast && forecast.length > 0 ? (
                        <Chart
                            data={forecast}
                            modelType={selectedModelType}
                            forecastDays={optimizationData?.forecast_days_used || debouncedForecastDays}
                        />
                    ) : (
                        <p style={{ textAlign: 'center' }}>Forecast data could not be loaded.</p>
                    )}

                    <div style={{ marginTop: '30px' }}>
                        <InventoryTable productId={selectedProductId} />
                    </div>
                </>
            )}
        </div>
    );
};

export default Dashboard;