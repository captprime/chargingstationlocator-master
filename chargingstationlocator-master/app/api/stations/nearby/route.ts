import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectDB from '@/lib/mongodb';
import ChargingStation from '@/models/ChargingStation';
import { calculateDistance } from '@/lib/geo-utils';

// Validation schema for query parameters
const NearbyStationsSchema = z.object({
  lat: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < -90 || num > 90) {
      throw new Error('Invalid latitude');
    }
    return num;
  }),
  lng: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < -180 || num > 180) {
      throw new Error('Invalid longitude');
    }
    return num;
  }),
  radius: z.string().optional().transform((val) => {
    if (!val) return 50; // Default radius of 50km
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0 || num > 200) {
      throw new Error('Invalid radius');
    }
    return num;
  }),
  limit: z.string().optional().transform((val) => {
    if (!val) return 20; // Default limit of 20 stations
    const num = parseInt(val);
    if (isNaN(num) || num <= 0 || num > 100) {
      throw new Error('Invalid limit');
    }
    return num;
  })
});

export async function GET(request: NextRequest) {
  try {
    // Connect to the database
    await connectDB();
    
    const { searchParams } = new URL(request.url);

    // Extract and validate query parameters
    const rawParams = {
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      radius: searchParams.get('radius'),
      limit: searchParams.get('limit')
    };

    console.log('API received params:', rawParams);

    // Check required parameters
    if (!rawParams.lat || !rawParams.lng) {
      return NextResponse.json(
        {
          error: 'Missing required parameters: lat and lng are required',
          stations: [],
          userLocation: null
        },
        { status: 400 }
      );
    }

    // Validate parameters
    const validatedParams = NearbyStationsSchema.parse(rawParams);
    console.log('Validated params:', validatedParams);
    
    // Get all stations from the database
    const allStations = await ChargingStation.find({}).lean();
    console.log(`Found ${allStations.length} stations in database`);
    
    if (allStations.length === 0) {
      console.log('No stations found in database');
      return NextResponse.json({
        stations: [],
        userLocation: {
          latitude: validatedParams.lat,
          longitude: validatedParams.lng
        },
        searchParams: {
          radius: validatedParams.radius,
          limit: validatedParams.limit,
          resultsCount: 0
        },
        debug: {
          message: 'No stations found in database. Please run the seed script.',
          totalStationsInDB: 0
        }
      });
    }
    
    // Calculate distance for each station and filter by radius
    const stations = allStations
      .map(station => {
        const distance = calculateDistance(
          validatedParams.lat,
          validatedParams.lng,
          station.latitude,
          station.longitude
        );
        
        return {
          id: station._id as string,
          name: station.name,
          latitude: station.latitude,
          longitude: station.longitude,
          pricePerKwh: station.pricePerKwh,
          queueLength: station.queueLength,
          amenities: station.amenities || [],
          fastCharging: (station as any).fastCharging ?? false,
          rating: (station as any).rating ?? 0,
          operatingHours: station.operatingHours,
          distance
        };
      })
      .filter(station => station.distance <= validatedParams.radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, validatedParams.limit);

    console.log(`Returning ${stations.length} stations within ${validatedParams.radius}km`);

    // Return response with stations and user location context
    return NextResponse.json({
      stations,
      userLocation: {
        latitude: validatedParams.lat,
        longitude: validatedParams.lng
      },
      searchParams: {
        radius: validatedParams.radius,
        limit: validatedParams.limit,
        resultsCount: stations.length
      },
      debug: {
        totalStationsInDB: allStations.length,
        stationsWithinRadius: stations.length
      }
    });

  } catch (error) {
    console.error('Error fetching nearby stations:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          details: error.message,
          stations: [],
          userLocation: null
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stations: [],
        userLocation: null
      },
      { status: 500 }
    );
  }
}