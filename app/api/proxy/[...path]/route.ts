/**
 * API Proxy Route
 * Proxies requests to Docker API to avoid CORS issues during development
 */
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
) {
        try {
          const pathString = path.join('/');
          const url = new URL(request.url);
          const queryString = url.search;
          
          // Ensure we don't double up /api in the path
          const cleanPath = pathString.startsWith('api/') ? pathString.substring(4) : pathString;
          const targetUrl = `${API_BASE_URL}/api/${cleanPath}${queryString}`;
    
    console.log(`[Proxy] ${method} ${targetUrl}`);
    
    // Prepare headers
    const headers: HeadersInit = {};
    
    // Copy authorization header if present
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Handle request body
    let body: BodyInit | undefined;
    const requestContentType = request.headers.get('content-type') || '';
    
    // Handle multipart/form-data (file uploads)
    if (requestContentType.includes('multipart/form-data')) {
      // For FormData, we need to forward it as-is
      // Get the boundary from Content-Type
      const boundary = requestContentType.split('boundary=')[1];
      if (boundary) {
        headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      }
      
      // Read the request body as ArrayBuffer to preserve binary data
      const arrayBuffer = await request.arrayBuffer();
      body = arrayBuffer;
      console.log('[Proxy] FormData upload detected, size:', arrayBuffer.byteLength, 'bytes');
    } else if (method !== 'GET' && method !== 'HEAD') {
      // Handle JSON/text requests
      try {
        const text = await request.text();
        if (text) {
          body = text;
          if (requestContentType.includes('application/json')) {
            headers['Content-Type'] = 'application/json';
          } else if (requestContentType) {
            headers['Content-Type'] = requestContentType;
          }
          console.log('[Proxy] Body received:', text?.substring(0, 100));
        }
      } catch (e) {
        console.log('[Proxy] No body or error reading body:', e);
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    // Get response content type
    const responseContentType = response.headers.get('content-type') || '';
    
    // Handle binary responses (Excel files, PDFs, images, etc.)
    if (
      responseContentType.includes('application/vnd.openxmlformats-officedocument') ||
      responseContentType.includes('application/vnd.ms-excel') ||
      responseContentType.includes('application/pdf') ||
      responseContentType.includes('image/') ||
      responseContentType.includes('application/octet-stream')
    ) {
      const buffer = await response.arrayBuffer();
      
      // Get all response headers
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });
      
      // Add CORS headers
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      console.log(`[Proxy] Binary response status: ${response.status}`);
      console.log(`[Proxy] Content-Type: ${responseContentType}`);
      console.log(`[Proxy] Buffer size: ${buffer.byteLength} bytes`);
      
      return new NextResponse(buffer, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Handle JSON/text responses
    const data = await response.text();
    console.log(`[Proxy] Response status: ${response.status}`);
    console.log(`[Proxy] Response data:`, data?.substring(0, 200));
    
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { message: data };
    }

    return NextResponse.json(jsonData, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Proxy request failed' },
      { status: 500 }
    );
  }
}
