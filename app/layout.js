export const metadata = {
  title: 'Church Pantry',
  description: 'Inventory management for church food pantries',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Church Pantry" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
