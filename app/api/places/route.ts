'use server';

import { NextRequest, NextResponse } from 'next/server';

const PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!PLACES_API_KEY) {
  console.error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.");
}

/**
 * Handles GET requests to fetch place predictions for autocomplete or place details.
 */
export async function GET(request: NextRequest) {
  if (!PLACES_API_KEY) {
    return NextResponse.json({ error: 'Server configuration error: Missing API key.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const placeId = searchParams.get('placeId');

  try {
    if (placeId) {
      // Fetch Place Details
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components&key=${PLACES_API_KEY}&language=it`;
      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        const errorBody = await detailsResponse.text();
        console.error(`Google Places Details API error: ${detailsResponse.status} ${errorBody}`);
        return NextResponse.json({ error: 'Failed to fetch place details' }, { status: detailsResponse.status });
      }
      const detailsData = await detailsResponse.json();
      const addressComponents = detailsData.result.address_components;

      const getComponent = (type: string) => addressComponents.find((c: any) => c.types.includes(type))?.long_name || '';

      const parsedAddress = {
        via: getComponent('route'),
        numeroCivico: getComponent('street_number'),
        citta: getComponent('locality'),
        provincia: getComponent('administrative_area_level_2'),
        cap: getComponent('postal_code'),
      };
      
      return NextResponse.json(parsedAddress);

    } else if (input) {
      // Fetch Autocomplete Predictions
      const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${PLACES_API_KEY}&language=it&components=country:it`;
      const autocompleteResponse = await fetch(autocompleteUrl);
      if (!autocompleteResponse.ok) {
        const errorBody = await autocompleteResponse.text();
        console.error(`Google Places Autocomplete API error: ${autocompleteResponse.status} ${errorBody}`);
        return NextResponse.json({ error: 'Failed to fetch autocomplete suggestions' }, { status: autocompleteResponse.status });
      }
      const autocompleteData = await autocompleteResponse.json();
      return NextResponse.json(autocompleteData.predictions || []);

    } else {
      return NextResponse.json({ error: 'Missing "input" or "placeId" parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in /api/places:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
