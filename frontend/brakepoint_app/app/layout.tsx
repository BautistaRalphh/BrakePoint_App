import Link from 'next/link'

export default function HomePage() {
  return (
    <html>
      <body> 
        <div
          className="container full-screen"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            minHeight: '60vh',
          }}
        >
          <h1 style={{ marginBottom: '1rem' }}>BrakePoint</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/login" className="btn" style={{ padding: '0.6rem 1rem', background: '#1976d2', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
              Login
            </Link>
            <Link href="/signup" className="btn" style={{ padding: '0.6rem 1rem', background: '#4caf50', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
              Signup
            </Link>
          </div>
        </div>
      </body>
    </html>
    
  )
}