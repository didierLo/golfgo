import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { XMLParser } from 'fast-xml-parser'
import AdmZip from 'adm-zip'
import { gunzipSync } from 'zlib'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

interface DmarcRecord {
  sourceIp: string
  count: number
  disposition: string
  dkimResult: string
  spfResult: string
  headerFrom: string
  orgName: string
}

function normalizeToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function extractXmlFromAttachment(filename: string, content: Buffer): string | null {
  const lower = filename.toLowerCase()
  try {
    if (lower.endsWith('.xml')) {
      return content.toString('utf-8')
    }
    if (lower.endsWith('.gz')) {
      return gunzipSync(content).toString('utf-8')
    }
    if (lower.endsWith('.zip')) {
      const zip = new AdmZip(content)
      const entries = zip.getEntries()
      const xmlEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.xml'))
      if (xmlEntry) return zip.readAsText(xmlEntry)
    }
  } catch (err) {
    console.error(`Failed to extract ${filename}:`, err)
  }
  return null
}

function parseDmarcXml(xml: string): DmarcRecord[] {
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(xml)
  const feedback = parsed.feedback
  if (!feedback) return []

  const orgName = feedback.report_metadata?.org_name ?? 'unknown'
  const records = normalizeToArray(feedback.record)

  return records.map((r: any): DmarcRecord => ({
    sourceIp: r.row?.source_ip ?? 'unknown',
    count: Number(r.row?.count ?? 0),
    disposition: r.row?.policy_evaluated?.disposition ?? 'unknown',
    dkimResult: r.row?.policy_evaluated?.dkim ?? 'unknown',
    spfResult: r.row?.policy_evaluated?.spf ?? 'unknown',
    headerFrom: r.identifiers?.header_from ?? 'unknown',
    orgName,
  }))
}

function buildSummaryHtml(allRecords: DmarcRecord[], messageCount: number, periodLabel: string): string {
  const totalVolume = allRecords.reduce((sum, r) => sum + r.count, 0)
  const dkimPass = allRecords.filter(r => r.dkimResult === 'pass').reduce((s, r) => s + r.count, 0)
  const spfPass = allRecords.filter(r => r.spfResult === 'pass').reduce((s, r) => s + r.count, 0)

  const bySource = new Map<string, number>()
  for (const r of allRecords) {
    bySource.set(r.orgName, (bySource.get(r.orgName) ?? 0) + r.count)
  }

  const fullFailures = allRecords.filter(r => r.dkimResult !== 'pass' && r.spfResult !== 'pass')

  const sourceRows = Array.from(bySource.entries())
    .map(([org, count]) => `<tr><td>${org}</td><td>${count}</td></tr>`)
    .join('')

  const failureRows = fullFailures.length
    ? fullFailures.map(r =>
        `<tr><td>${r.sourceIp}</td><td>${r.headerFrom}</td><td>${r.count}</td><td>${r.disposition}</td></tr>`
      ).join('')
    : '<tr><td colspan="4">Aucun échec complet DKIM+SPF détecté ce mois-ci.</td></tr>'

  return `
    <h2>Rapport DMARC mensuel — golfgo.be</h2>
    <p><strong>Période analysée :</strong> ${periodLabel}</p>
    <p><strong>Rapports traités :</strong> ${messageCount}</p>
    <p><strong>Volume total d'emails :</strong> ${totalVolume}</p>
    <p><strong>Taux DKIM aligné :</strong> ${totalVolume ? Math.round((dkimPass / totalVolume) * 100) : 0}%</p>
    <p><strong>Taux SPF aligné :</strong> ${totalVolume ? Math.round((spfPass / totalVolume) * 100) : 0}%</p>

    <h3>Volume par source</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse">
      <tr><th>Fournisseur</th><th>Emails</th></tr>
      ${sourceRows}
    </table>

    <h3>Échecs complets (DKIM + SPF) à surveiller</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse">
      <tr><th>IP source</th><th>Domaine From</th><th>Volume</th><th>Disposition</th></tr>
      ${failureRows}
    </table>
  `
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  })

  const allRecords: DmarcRecord[] = []
  let messageCount = 0
  const now = new Date()
  const periodLabel = now.toLocaleDateString('fr-BE', { year: 'numeric', month: 'long' })

  try {
    await client.connect()
    const lock = await client.getMailboxLock('DMARC-golfgo')

    try {
      const uids = await client.search({ seen: false })

      for (const uid of uids || []) {
        const message = await client.fetchOne(uid, { source: true })
        if (!message || !message.source) continue

        const parsed = await simpleParser(message.source)
        messageCount++

        for (const attachment of parsed.attachments) {
          const xml = extractXmlFromAttachment(attachment.filename ?? '', attachment.content)
          if (xml) {
            const records = parseDmarcXml(xml)
            allRecords.push(...records)
          }
        }

        await client.messageFlagsAdd(uid, ['\\Seen'])
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    console.error('IMAP error:', err)
    return NextResponse.json({ error: 'IMAP processing failed', details: String(err) }, { status: 500 })
  }

  const summaryHtml = buildSummaryHtml(allRecords, messageCount, periodLabel)

  try {
    await resend.emails.send({
      from: 'GolfGo <noreply@golfgo.be>',
      to: 'didier.lozet@gmail.com',
      subject: `Rapport DMARC golfgo.be — ${periodLabel}`,
      html: summaryHtml,
    })
  } catch (err) {
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'Email send failed', details: String(err) }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    messagesProcessed: messageCount,
    recordsAggregated: allRecords.length,
  })
}