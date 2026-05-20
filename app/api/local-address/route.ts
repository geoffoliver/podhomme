import os from 'os';

export async function GET(request: Request) {
  const host = request.headers.get('host') ?? '';
  const port = host.includes(':') ? host.split(':')[1] : '80';

  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (iface): iface is os.NetworkInterfaceInfo =>
        !!iface && iface.family === 'IPv4' && !iface.internal,
    )
    .map((iface) => `http://${iface.address}:${port}`);

  return Response.json({ addresses });
}
