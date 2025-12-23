'use client';

import React, { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AddressInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (value: string) => void;
}

interface Suggestion {
  description: string;
  place_id: string;
}

const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChange,
  className,
  ...props
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [debouncedValue] = useDebounce(inputValue, 400); // 400ms debounce delay
  const [isListVisible, setIsListVisible] = useState(true);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!apiKey) {
        console.error("Google Maps API key is not configured.");
        return;
      }
      if (debouncedValue.length > 2) {
        try {
          // IMPORTANT: We are proxying the request through our own API route to avoid exposing the API key to the client.
          const response = await fetch(`/api/places?input=${encodeURIComponent(debouncedValue)}`);
          const data = await response.json();
          if (data.predictions) {
            setSuggestions(data.predictions);
            setIsListVisible(true);
          } else {
            setSuggestions([]);
          }
        } catch (error) {
          console.error('Error fetching address suggestions:', error);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [debouncedValue, apiKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setInputValue(suggestion.description);
    onChange(suggestion.description);
    setSuggestions([]);
    setIsListVisible(false);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        {...props}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={() => setTimeout(() => setIsListVisible(false), 100)} // Delay to allow click
        onFocus={() => setIsListVisible(true)}
        autoComplete="off"
      />
      {isListVisible && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.place_id}
              className="px-3 py-2 cursor-pointer hover:bg-accent"
              onMouseDown={(e) => { // Use onMouseDown to prevent blur from firing first
                e.preventDefault();
                handleSuggestionClick(suggestion);
              }}
            >
              {suggestion.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressInput;
