import React from 'react';

const OptimizationDisplay = ({ data, modelType, inputAssumptions }) => {

    if (!data || typeof inputAssumptions?.leadTime === 'undefined') {
        return <p style={{ textAlign: 'center', padding: '20px' }}>Loading optimization metrics...</p>;
    }

    const {
        product_id = "N/A",
        current_inventory = "N/A",
        safety_stock = "N/A",
        reorder_point = "N/A",
        economic_order_quantity = "N/A",
        demand_during_lead_time = "N/A",
        suggestion = "N/A",
        model_type_used = modelType,
        forecast_days_used,
        assumptions_used = {}
    } = data;

    const { leadTime, serviceLevel, holdingCost, orderingCost } = inputAssumptions;

    const {
        seasonal_periods_used,
        demand_variability_method = "N/A",
        annual_demand_method = "N/A"
    } = assumptions_used;

    const containerStyle = {
        border: '1px solid #ccc',
        padding: '20px',
        margin: '20px auto',
        maxWidth: '950px',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    };
    const flexContainerStyle = {
        display: 'flex',
        gap: '40px',
        flexWrap: 'wrap'
    };
    const columnStyle = {
        flex: '1',
        minWidth: '300px',
    };
    const columnTitleStyle = {
        marginTop: 0,
        marginBottom: '15px',
        borderBottom: '1px solid #ccc',
        paddingBottom: '10px',
        fontSize: '1.1em',
        color: '#333',
    };
    const tableStyle = {
        width: '100%',
        textAlign: 'left',
        borderCollapse: 'collapse'
    };
    const tdHeaderStyle = {
        fontWeight: '600',
        padding: '10px 5px',
        borderBottom: '1px solid #eee',
        verticalAlign: 'top',
        color: '#444',
        width: '45%',
    };
    const tdValueStyle = {
        padding: '10px 5px',
        borderBottom: '1px solid #eee',
        verticalAlign: 'top',
        color: '#555',
    };
    const suggestionRowStyle = {
        backgroundColor: '#e6f7ff',
    };
    const suggestionHeaderStyle = {
        ...tdHeaderStyle,
        borderTop: '2px solid #b3e0ff',
    };
    const suggestionValueStyle = {
        ...tdValueStyle,
        fontWeight: 'bold',
        borderTop: '2px solid #b3e0ff',
        color: '#005689',
    };

    const formatCurrency = (value) => {
        if (value === '' || value === null || isNaN(Number(value))) return 'N/A';
        return Number(value).toFixed(2);
    };

    return (
        <div style={containerStyle}>
            <h2 style={{ textAlign: 'center', marginBottom: '25px', color: '#222' }}>
                Inventory Optimization Metrics: {product_id}
            </h2>

            <div style={flexContainerStyle}>

                <div style={columnStyle}>
                    <h4 style={columnTitleStyle}>Inputs Used</h4>
                    <table style={tableStyle}>
                        <tbody>
                            <tr>
                                <td style={tdHeaderStyle}>Lead Time:</td>
                                <td style={tdValueStyle}>{leadTime !== '' ? leadTime : 'N/A'} days</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Service Level:</td>
                                <td style={tdValueStyle}>{serviceLevel !== '' ? serviceLevel : 'N/A'}%</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Annual Holding Cost:</td>
                                <td style={tdValueStyle}>${formatCurrency(holdingCost)} / unit</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Ordering Cost:</td>
                                <td style={tdValueStyle}>${formatCurrency(orderingCost)} / order</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Forecast Model:</td>
                                <td style={tdValueStyle}>{model_type_used}</td>
                            </tr>
                            {model_type_used === 'ExponentialSmoothing' && seasonal_periods_used && (
                                <tr>
                                    <td style={tdHeaderStyle}>Seasonal Periods:</td>
                                    <td style={tdValueStyle}>{seasonal_periods_used}</td>
                                </tr>
                            )}
                            {forecast_days_used && (
                                <tr>
                                    <td style={tdHeaderStyle}>Forecast Horizon:</td>
                                    <td style={tdValueStyle}>{forecast_days_used} days</td>
                                </tr>
                            )}
                            <tr>
                                <td style={tdHeaderStyle}>Demand Variability:</td>
                                <td style={tdValueStyle}>{demand_variability_method}</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Annual Demand Basis:</td>
                                <td style={tdValueStyle}>{annual_demand_method}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={columnStyle}>
                    <h4 style={columnTitleStyle}>Calculated Metrics & Suggestion</h4>
                    <table style={tableStyle}>
                        <tbody>
                            <tr>
                                <td style={tdHeaderStyle}>Current Inventory:</td>
                                <td style={tdValueStyle}>{current_inventory} units</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Safety Stock (SS):</td>
                                <td style={tdValueStyle}>{safety_stock} units</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Demand During Lead Time:</td>
                                <td style={tdValueStyle}>{demand_during_lead_time} units</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle} title="Economic Order Quantity: Aims to minimize total inventory costs (holding + ordering)">EOQ:</td>
                                <td style={tdValueStyle}>{economic_order_quantity} units</td>
                            </tr>
                            <tr>
                                <td style={tdHeaderStyle}>Reorder Point (ROP):</td>
                                <td style={tdValueStyle}>{reorder_point} units</td>
                            </tr>
                            <tr style={suggestionRowStyle}>
                                <td style={suggestionHeaderStyle}>Suggestion:</td>
                                <td style={suggestionValueStyle}>{suggestion}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OptimizationDisplay;