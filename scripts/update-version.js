#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '..')
const VERSION_FILE = join(ROOT_DIR, 'lib/Defaults/index.js')

function getCurrentVersion() {
	const content = readFileSync(VERSION_FILE, 'utf-8')
	const match = content.match(/export const version = \[(\d+),\s*(\d+),\s*(\d+)\]/)
	if (!match) throw new Error('Could not find version in lib/Defaults/index.js')
	return [+match[1], +match[2], +match[3]]
}

function updateVersion(newVersion) {
	const content = readFileSync(VERSION_FILE, 'utf-8')
	const current = getCurrentVersion()

	if (current[0] === newVersion[0] && current[1] === newVersion[1] && current[2] === newVersion[2]) {
		console.log(`Version already up to date: [${current.join(', ')}]`)
		return false
	}

	const updated = content.replace(
		/export const version = \[\d+,\s*\d+,\s*\d+\]/,
		`export const version = [${newVersion.join(', ')}]`
	)

	writeFileSync(VERSION_FILE, updated)
	console.log(`Updated version: [${current.join(', ')}] → [${newVersion.join(', ')}]`)
	return true
}

async function fetchLatestVersion() {
	const response = await fetch('https://web.whatsapp.com/sw.js', {
		method: 'GET',
		headers: {
			'sec-fetch-site': 'none',
			'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
		}
	})
	if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`)

	const data = await response.text()
	const match = data.match(/\\?"client_revision\\?":\s*(\d+)/)
	if (!match?.[1]) throw new Error('Could not find client revision')

	return [2, 3000, +match[1]]
}

async function main() {
	const versionArg = process.argv[2]

	let version
	if (versionArg) {
		version = versionArg.split('.').map(Number)
		if (version.length !== 3 || version.some(isNaN)) {
			console.error('Usage: node update-version.js [major.minor.revision]')
			process.exit(1)
		}
	} else {
		console.log('Fetching latest WhatsApp Web version...')
		version = await fetchLatestVersion()
	}

	const updated = updateVersion(version)

	if (process.env.GITHUB_OUTPUT) {
		const { appendFileSync } = await import('fs')
		appendFileSync(process.env.GITHUB_OUTPUT, `updated=${updated}\n`)
		if (updated) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version.join('.')}\n`)
	}
}

main().catch(error => {
	console.error('Fatal error:', error)
	process.exit(1)
})
