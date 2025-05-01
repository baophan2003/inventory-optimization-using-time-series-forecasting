import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, Label } from "recharts";

const Chart = ({ data, modelType, forecastDays }) => {

    const formattedData = data.map((value, index) => ({
        day: index + 1,
        forecast: value
    }));

    return (
        <div style={{ width: '90%', height: 350, margin: '20px auto' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={formattedData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                        dataKey="day"
                        height={50}
                    >
                        <Label value={`Forecast Day (out of ${forecastDays})`} offset={0} position="insideBottom" dy={10} />
                    </XAxis>

                    <YAxis>
                        <Label value="Predicted Units Sold" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>

                    <Tooltip />

                    <Legend verticalAlign="top" height={36} />

                    <Line
                        type="monotone"
                        dataKey="forecast"
                        name={`Forecast (${modelType})`}
                        stroke="#8884d8"
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                        dot={data.length < 60}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default Chart;