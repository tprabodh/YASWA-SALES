import React from 'react';

const SearchBar = ({ query, setQuery }) => (
  <input
    type="text"
    placeholder="Search by name or ID"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    style={{ marginBottom: '1rem', padding: '0.5rem', width: '100%' }}
  />
);

export default SearchBar;
