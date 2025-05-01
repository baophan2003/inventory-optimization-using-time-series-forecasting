import React, { useEffect, useState } from "react";

const InventoryTable = ({ productId }) => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setInventory([]);
        setError(null);

        if (!productId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        fetch(`http://localhost:8000/inventory/${productId}`)
            .then(response => {
                if (!response.ok) {
                    return response.json()
                        .then(errData => {
                            throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
                        })
                        .catch(() => {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        });
                }
                return response.json();
            })
            .then(data => {
                setInventory(data);
                setError(null);
            })
            .catch(error => {
                console.error("Error fetching inventory data:", error);
                setError(`Failed to load inventory data: ${error.message}`);
                setInventory([]);
            })
            .finally(() => {
                setLoading(false);
            });

    }, [productId]);

    if (loading) {
        return <p style={{ textAlign: 'center', padding: '20px' }}>Loading historical inventory data...</p>;
    }

    if (error) {
        return <p style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</p>;
    }

    if (!inventory.length) {
        return <p style={{ textAlign: 'center', padding: '20px' }}>No historical inventory data available for this product.</p>
    }

    return (
        <div>
            <h3 style={{ textAlign: 'center' }}>Historical Data (Latest 100 Entries)</h3>
            <table border="1" style={{ margin: 'auto', marginTop: '10px', borderCollapse: 'collapse', width: '80%', maxWidth: '800px', fontSize: '0.9em' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Date</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Inventory Level</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Units Sold</th>
                    </tr>
                </thead>
                <tbody>
                    {inventory.slice(-100).reverse().map((row, index) => (
                        <tr key={`${row.date}-${index}`}>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{row.date}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                {row.inventoryLevel !== null && typeof row.inventoryLevel !== 'undefined' ? row.inventoryLevel : "N/A"}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                {row.unitsSold !== null && typeof row.unitsSold !== 'undefined' ? row.unitsSold : "N/A"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default InventoryTable;