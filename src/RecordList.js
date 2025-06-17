import React, { useState, useEffect } from 'react';
import axios from 'axios';
import _ from 'lodash'; // npm install lodash

function RecordList({ onSelectRecord }) {
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deviceKeys, setDeviceKeys] = useState([]);
  const [measurementSummaries, setMeasurementSummaries] = useState([]);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState('');
  const [selectedMeasurementSummary, setSelectedMeasurementSummary] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventType, setSelectedEventType] = useState('');
  const [selectedsearchTerm, setSelectedsearchTerm] = useState('');
 // const url = 'http://localhost:3001'; // Change this to your API URL
  const url = 'https://jsonata.appleby-analytics.com';

  // Fetch filter data
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const deviceKeysResponse = await axios.get(url + '/api/device_keys');
        setDeviceKeys(deviceKeysResponse.data);

        const measurementSummariesResponse = await axios.get(url + '/api/measurement_summaries');
        setMeasurementSummaries(measurementSummariesResponse.data);

        const eventTypesResponse = await axios.get(url + '/api/event_types');
        setEventTypes(eventTypesResponse.data);
      } catch (error) {
        console.error('Error fetching filters:', error);
      }
    };

    fetchFilters();
  }, []);

  // Fetch records based on filters
  const fetchRecords = async () => {
    console.log(
      `Fetching records for page ${page}, device_key: ${selectedDeviceKey}, measurement_summary: ${selectedMeasurementSummary}, event_type: ${selectedEventType}, search_term: ${selectedsearchTerm}`
    );

    try {
      const response = await axios.get(url + '/api/records', {
        params: {
          page,
          device_key: selectedDeviceKey,
          measurement_summary: selectedMeasurementSummary,
          event_type: selectedEventType,
          search_term: selectedsearchTerm,
        },
      });
      console.log('Records fetched successfully:', response.data);

      setRecords(response.data.records);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching records:', error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, selectedDeviceKey, selectedMeasurementSummary, selectedsearchTerm, selectedEventType]);

  const loadRecord = async (recordId) => {
    console.log(`Attempting to load record with ID: ${recordId}`);
    try {
      const response = await axios.get(url + `/api/record/${recordId}`);
      console.log('Record loaded successfully:', response.data);
      setSelectedRecordId(recordId);
      onSelectRecord(response.data);
    } catch (error) {
      console.error('Error loading record:', error);
    }
  };

  const loadNextRecord = async () => {
    if (selectedRecordId) {
      try {
        const response = await axios.get(url + `/api/record/${selectedRecordId}/next`, {
          params: {
            device_key: selectedDeviceKey,
            measurement_summary: selectedMeasurementSummary,
            event_type: selectedEventType,
            search_term: selectedsearchTerm,
          },
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
        const response = await axios.get(url + `/api/record/${selectedRecordId}/previous`, {
          params: {
            device_key: selectedDeviceKey,
            measurement_summary: selectedMeasurementSummary,
            event_type: selectedEventType,
            search_term: selectedsearchTerm,
          },
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
          <select value={selectedDeviceKey} onChange={(e) => setSelectedDeviceKey(e.target.value)}>
            <option value="">All</option>
            {deviceKeys.map((deviceKey) => (
              <option key={deviceKey} value={deviceKey}>
                {deviceKey}
              </option>
            ))}
          </select>
        </label>
        <label>
          Measurement Summary:
          <select value={selectedMeasurementSummary} onChange={(e) => setSelectedMeasurementSummary(e.target.value)}>
            <option value="">All</option>
            {measurementSummaries.map((summary) => (
              <option key={summary} value={summary}>
                {summary}
              </option>
            ))}
          </select>
        </label>

        <label>
          Event Type:
          <select value={selectedEventType} onChange={(e) => setSelectedEventType(e.target.value)}>
            <option value="">All</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search:
          <input
            type="text"
            placeholder="Search..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const searchTerm = e.target.value.toLowerCase();
                setSelectedsearchTerm(searchTerm);
                fetchRecords(); // Fetch records based on the search term
              } else if (e.key === 'Escape') {
                e.target.value = '';
                setSelectedsearchTerm('');
                fetchRecords(); // Reset to original records
              }
            }}
          />
        </label>
      </div>
      <ul>
        {records.map((record) => (
          <li key={record.id} style={{ backgroundColor: selectedRecordId === record.id ? 'lightgray' : 'white' }}>
            {new Date(record.device_time).toLocaleString()} - {record.measurement_summary} - {record.device_key}
            <button onClick={() => loadRecord(record.id)}>Load</button>
          </li>
        ))}
      </ul>
      <div>
        <button onClick={() => setPage((page) => Math.max(page - 1, 1))} disabled={page === 1}>
          Previous Page
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button onClick={() => setPage((page) => Math.min(page + 1, totalPages))} disabled={page === totalPages}>
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
