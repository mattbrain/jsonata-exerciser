// RecordList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function RecordList({ onSelectRecord }) {
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await axios.get('https://jsonata.appleby-analytics.com/api/records', {
          params: { page }
        });
        setRecords(response.data.records);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error('Error fetching records:', error);
      }
    };

    fetchRecords();
  }, [page]);

  return (
    <div>
      <ul>
        {records.map(record => (
          <li key={record.id}>
            {new Date(record.device_time).toLocaleString()} - {record.rule_name}
            <button onClick={() => onSelectRecord(record.id)}>Load</button>
          </li>
        ))}
      </ul>
      <div>
        <button onClick={() => setPage(page => Math.max(page - 1, 1))} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button onClick={() => setPage(page => Math.min(page + 1, totalPages))} disabled={page === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

export default RecordList;
