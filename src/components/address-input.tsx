'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddressSuggestion {
  description: string;
  place_id: string;
}

interface ParsedAddress {
    via: string;
    numeroCivico: string;
    citta: string;
    provincia: string;
    cap: string;
}

interface AddressInputProps {
  onAddressSelect: (address: ParsedAddress) => void;
  disabled?: boolean;
}

export function AddressInput({ onAddressSelect, disabled }: AddressInputProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 400);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedQuery.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`/api/places?input=${debouncedQuery}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching address suggestions:', error);
        setSuggestions([]);
      }
    };

    if (!disabled) {
        fetchSuggestions();
    }
  }, [debouncedQuery, disabled]);

  const handleSelectSuggestion = async (placeId: string) => {
    // Clear query and suggestions for a clean UI
    setQuery('');
    setSuggestions([]);
    
    try {
        const response = await fetch(`/api/places?placeId=${placeId}`);
        if(!response.ok) throw new Error('Failed to fetch place details');
        const data: ParsedAddress = await response.json();
        onAddressSelect(data);
    } catch(error) {
        console.error('Error fetching place details:', error);
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  return (
    <div className="grid gap-2 relative" ref={containerRef}>
      <Label htmlFor="address-search">Cerca Indirizzo</Label>
      <Input
        id="address-search"
        placeholder="Inizia a digitare un indirizzo..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        disabled={disabled}
      />
      {suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-background border border-border rounded-md shadow-lg z-10">
          <ul className="py-1">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.place_id}
                className="px-3 py-2 cursor-pointer hover:bg-accent"
                onMouseDown={() => handleSelectSuggestion(suggestion.place_id)}
              >
                {suggestion.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
