import React, { useState, useEffect } from 'react';
import axios from 'axios';

function RecordList({ onSelectRecord }) {
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deviceKeys, setDeviceKeys] = useState([]);
  const [measurementSummaries, setMeasurementSummaries] = useState([]);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState('');
  const [selectedMeasurementSummary, setSelectedMeasurementSummary] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);

  // Fetch filter data
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const deviceKeysResponse = await axios.get('https://jsonata.appleby-analytics.com/api/device_keys');
        setDeviceKeys(deviceKeysResponse.data);

        const measurementSummariesResponse = await axios.get('https://jsonata.appleby-analytics.com/api/measurement_summaries');
        setMeasurementSummaries(measurementSummariesResponse.data);
      } catch (error) {
        console.error('Error fetching filters:', error);
      }
    };

    fetchFilters();
  }, []);

  // Fetch records based on filters
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await axios.get('https://jsonata.appleby-analytics.com/api/records', {
          params: { page, device_key: selectedDeviceKey, measurement_summary: selectedMeasurementSummary }
        });
        setRecords(response.data.records);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error('Error fetching records:', error);
      }
    };

    fetchRecords();
  }, [page, selectedDeviceKey, selectedMeasurementSummary]);

  const loadRecord = async (recordId) => {
    console.log(`Attempting to load record with ID: ${recordId}`);
    try {
      const response = await axios.get(`https://jsonata.appleby-analytics.com/api/record/${recordId}`);
      console.log('Record loaded successfully:', response.data);
      setSelectedRecordId(recordId); // Store only the record ID
      onSelectRecord(response.data); // Pass the data to the parent component
    } catch (error) {
      console.error('Error loading record:', error);
    }
  };

  const loadNextRecord = async () => {
    if (selectedRecordId) {
      try {
        const response = await axios.get(`https://jsonata.appleby-analytics.com/api/record/${selectedRecordId}/next`, {
          params: { device_key: selectedDeviceKey, measurement_summary: selectedMeasurementSummary }
        });
        if (response.data && response.data.id) {
          loadRecord(response.data.id);
        }
      } catch (error) {
        console.error('Error loading next record:', error);
      }
    }
  };

  const loadPreviousRecord = async () => {
    if (selectedRecordId) {
      try {
        const response = await axios.get(`https://jsonata.appleby-analytics.com/api/record/${selectedRecordId}/previous`, {
          params: { device_key: selectedDeviceKey, measurement_summary: selectedMeasurementSummary }
        });
        if (response.data && response.data.id) {
          loadRecord(response.data.id);
        }
      } catch (error) {
        console.error('Error loading previous record:', error);
      }
    }
  };

  return (
    <div>
      <div>
        <label>
          Device Key:
          <select value={selectedDeviceKey} onChange={e => setSelectedDeviceKey(e.target.value)}>
            <option value=''>All</option>
            {deviceKeys.map(deviceKey => (
              <option key={deviceKey} value={deviceKey}>
                {deviceKey}
              </option>
            ))}
          </select>
        </label>
        <label>
          Measurement Summary:
          <select value={selectedMeasurementSummary} onChange={e => setSelectedMeasurementSummary(e.target.value)}>
            <option value=''>All</option>
            {measurementSummaries.map(summary => (
              <option key={summary} value={summary}>
                {summary}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul>
        {records.map(record => (
          <li key={record.id} style={{ backgroundColor: selectedRecordId === record.id ? 'lightgray' : 'white' }}>
            {new Date(record.device_time).toLocaleString()} - {record.measurement_summary} - {record.device_key}
            <button onClick={() => loadRecord(record.id)}>Load</button>
          </li>
        ))}
      </ul>
      <div>
        <button onClick={() => setPage(page => Math.max(page - 1, 1))} disabled={page === 1}>
          Previous Page
        </button>
        <span>Page {page} of {totalPages}</span>
        <button onClick={() => setPage(page => Math.min(page + 1, totalPages))} disabled={page === totalPages}>
          Next Page
        </button>
      </div>
      <div>
        <button onClick={loadPreviousRecord} disabled={!selectedRecordId}>
          Previous Record
        </button>
        <button onClick={loadNextRecord} disabled={!selectedRecordId}>
          Next Record
        </button>
      </div>
    </div>
  );
}

export default RecordList;
