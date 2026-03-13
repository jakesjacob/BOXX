import { ImageResponse } from 'next/og';

export const alt = 'Zatrovo — Studio Management Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          position: 'relative',
        }}
      >
        {/* Subtle border frame */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: '1px solid rgba(200,167,80,0.15)',
            display: 'flex',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 2,
            background: '#c8a750',
            display: 'flex',
          }}
        />

        {/* Overline */}
        <span
          style={{
            fontSize: 14,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: '#c8a750',
            marginBottom: 32,
          }}
        >
          Studio Management
        </span>

        {/* Logo text */}
        <span
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: '#f5f5f5',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          ZATROVO
        </span>

        {/* Divider */}
        <div
          style={{
            width: 48,
            height: 1,
            background: '#c8a750',
            marginTop: 36,
            marginBottom: 36,
            display: 'flex',
          }}
        />

        {/* Tagline */}
        <span
          style={{
            fontSize: 22,
            color: 'rgba(245,245,245,0.5)',
            letterSpacing: '0.12em',
          }}
        >
          Run Your Studio, Your Way
        </span>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 2,
            background: '#c8a750',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
