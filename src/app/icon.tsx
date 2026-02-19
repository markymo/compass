import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
    width: 512,
    height: 512,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    background: '#0f172a', // slate-900
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    padding: '40px', // Slight padding (approx 1.25px in 16x16 scale)
                }}
            >
                <div style={{
                    width: '200px', // Approx 6.25px in 16x16 scale (under 7px/25%)
                    height: '200px',
                    backgroundColor: '#f59e0b', // amber-500
                }} />
            </div>
        ),
        {
            ...size,
        }
    )
}
