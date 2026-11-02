import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const indexPath = path.join(process.cwd(), '.output', 'public', 'index.html')

if (!existsSync(indexPath)) {
  throw new Error(`Missing generated entry page: ${indexPath}`)
}

const html = readFileSync(indexPath, 'utf8')
if (html.trim() === '"Redirecting..."') {
  throw new Error('Generated entry page is a redirect placeholder, not the application.')
}

if (!html.includes('<html') || !html.includes('assets/')) {
  throw new Error('Generated entry page is missing the HTML shell or bundled application assets.')
}

console.log(`Verified static application entry page: ${indexPath}`)
