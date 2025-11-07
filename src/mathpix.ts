const PROXY = process.env.EXPO_PUBLIC_MATHPIX_PROXY_URL || 'http://localhost:5056/recognize';


export async function recognizeHandwriting(pngBase64: string): Promise<string> {
  console.log('📡 Fetching from:', PROXY);
  console.log('📏 Image data length:', pngBase64.length);
  
  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: pngBase64 })
  });
  
  console.log('📥 Response status:', r.status);
  
  if (!r.ok) {
    const errorText = await r.text();
    console.log('❌ Error response:', errorText);
    throw new Error(`recognition failed: ${r.status} ${errorText}`);
  }
  
  const data = await r.json();
  console.log('📦 Response data:', data);
  
  return (data.text || '').trim();
}
