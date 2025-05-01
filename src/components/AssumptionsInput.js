import React from 'react';

const AssumptionsInput = ({ assumptions, onAssumptionChange, disabled, isDebouncing, debouncedAssumptions }) => {

    const inputStyle = {
        width: '80px',
        padding: '5px',
        marginLeft: '5px',
        marginRight: '5px',
        border: '1px solid #ccc',
        borderRadius: '3px',
    };
    const labelStyle = {
        display: 'inline-block',
        minWidth: '120px',
        textAlign: 'right',
        marginRight: '5px',
    };
    const unitStyle = {
        display: 'inline-block',
        minWidth: '40px',
        textAlign: 'left',
        fontSize: '0.9em',
        color: '#555',
    };
    const currencyStyle = {
        display: 'inline-block',
        marginRight: '2px',
        color: '#555',
        width: '10px',
        textAlign: 'right',
    };
    const rowStyle = {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '10px',
        minHeight: '30px',
    };
    const settingsBoxStyle = {
        border: '1px solid #ddd',
        padding: '15px 20px',
        borderRadius: '5px',
        backgroundColor: '#fafafa',
        minWidth: '350px',
    };
    const loadingIndicatorStyle = {
        color: '#cc7a00',
        fontStyle: 'italic',
        marginLeft: '10px',
        fontSize: '0.9em'
    };

    const isFieldDebouncing = (fieldName) => {
        return isDebouncing && assumptions[fieldName] !== debouncedAssumptions?.[fieldName];
    };

    return (
        <div style={settingsBoxStyle}>
            <h4>Calculation Assumptions</h4>

            <div style={rowStyle}>
                <label htmlFor="leadTime" style={labelStyle}>Lead Time:</label>
                <input
                    type="number"
                    id="leadTime"
                    name="leadTime"
                    value={assumptions.leadTime}
                    onChange={onAssumptionChange}
                    disabled={disabled}
                    min="1"
                    step="1"
                    style={inputStyle}
                />
                <span style={unitStyle}>days</span>
                {isFieldDebouncing('leadTime') && <span style={loadingIndicatorStyle}>Updating...</span>}
            </div>

            <div style={rowStyle}>
                <label htmlFor="serviceLevel" style={labelStyle}>Service Level:</label>
                <input
                    type="number"
                    id="serviceLevel"
                    name="serviceLevel"
                    value={assumptions.serviceLevel}
                    onChange={onAssumptionChange}
                    disabled={disabled}
                    min="0"
                    max="100"
                    step="0.1"
                    style={inputStyle}
                />
                <span style={unitStyle}>%</span>
                {isFieldDebouncing('serviceLevel') && <span style={loadingIndicatorStyle}>Updating...</span>}
            </div>

            <div style={rowStyle}>
                <label htmlFor="holdingCost" style={labelStyle}>Annual Holding Cost:</label>
                <span style={currencyStyle}>$</span>
                <input
                    type="number"
                    id="holdingCost"
                    name="holdingCost"
                    value={assumptions.holdingCost}
                    onChange={onAssumptionChange}
                    disabled={disabled}
                    min="0"
                    step="0.01"
                    style={inputStyle}
                />
                <span style={unitStyle}>/ unit</span>
                {isFieldDebouncing('holdingCost') && <span style={loadingIndicatorStyle}>Updating...</span>}
            </div>

            <div style={{ ...rowStyle, marginBottom: 0 }}>
                <label htmlFor="orderingCost" style={labelStyle}>Ordering Cost:</label>
                <span style={currencyStyle}>$</span>
                <input
                    type="number"
                    id="orderingCost"
                    name="orderingCost"
                    value={assumptions.orderingCost}
                    onChange={onAssumptionChange}
                    disabled={disabled}
                    min="0"
                    step="0.01"
                    style={inputStyle}
                />
                <span style={unitStyle}>/ order</span>
                {isFieldDebouncing('orderingCost') && <span style={loadingIndicatorStyle}>Updating...</span>}
            </div>
        </div>
    );
};

export default AssumptionsInput;