import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
    width: 32,
    height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    fontSize: 18,
                    background: '#0f172a', // slate-900
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    borderRadius: '6px',
                    fontFamily: 'sans-serif',
                    fontWeight: 800,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'baseline', position: 'relative', top: '1px' }}>
                    <span>ON</span>
                    <div style={{
                        width: '4px',
                        height: '4px',
                        backgroundColor: '#f59e0b', // amber-500
                        marginLeft: '1px',
                    }} />
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
