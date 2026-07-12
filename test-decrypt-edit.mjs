import { proto } from './WAProto/index.js'
import { aesDecryptGCM, aesEncryptGCM, hmacSign } from './lib/Utils/crypto.js'
import { randomBytes } from 'crypto'
import { normalizeMessageContent } from './lib/Utils/messages.js'
import { jidNormalizedUser } from './lib/WABinary/index.js'

function toBinary(txt) {
	return Buffer.from(txt)
}

/**
 * Decrypt a SecretEncryptedMessage (MESSAGE_EDIT)
 * Key: HMAC-SHA256(origMsgId + origMsgSenderJid + editorJid + 'Message Edit' + version, HMAC-SHA256(msgEncKey, zeros))
 * AAD: EMPTY (unlike poll/event)
 */
function decryptMessageEdit({ encPayload, encIv }, { origMsgId, origMsgSenderJid, editorJid, msgEncKey }) {
	if (typeof msgEncKey === 'string') {
		msgEncKey = Buffer.from(msgEncKey, 'base64')
	}
	const payload = Buffer.isBuffer(encPayload) ? encPayload : Buffer.from(encPayload)
	const iv = Buffer.isBuffer(encIv) ? encIv : Buffer.from(encIv)

	const sign = Buffer.concat([
		toBinary(origMsgId),
		toBinary(origMsgSenderJid),
		toBinary(editorJid),
		toBinary('Message Edit'),
		new Uint8Array([1])
	])
	const key0 = hmacSign(msgEncKey, new Uint8Array(32), 'sha256')
	const decKey = hmacSign(sign, key0, 'sha256')
	// AAD kosong — berbeda dengan poll/event
	const decrypted = aesDecryptGCM(payload, decKey, iv, new Uint8Array(0))
	return proto.Message.decode(decrypted)
}

// === Test data ===
const data = {
	targetMessageKey: {
		remoteJid: '120363423077197619@g.us',
		fromMe: true,
		id: 'AC9EFEE7C2C974068119A349436C85F1'
	},
	encPayload: 'UatmpaBLN8VaUOMN2csQJ4QpIW12BLFVn9rY3LcdFjfTvStaav/rBuTuCWVMIWKUxR5xqnWb+Cw6WVSh2bVs/MaWNhHsQtiOq8L5du0a58p3dO701qpLPyIEVjVyOHBJHnLW88WwyOzrTN0NPtKSybjeyAVrC3z3Tfft4Vf9FYaR2n3g3g==',
	encIv: '0e3qMh73fjauTPpa',
	secretEncType: 'MESSAGE_EDIT'
}

const messageSecretHex = process.argv[2]
const senderJidArg = process.argv[3]

if (!messageSecretHex) {
	console.log('Usage: node test-decrypt-edit.mjs <messageSecretHex> [senderJid]')
	console.log('')
	console.log('messageSecret dari pesan asli yang di-edit (hex)')
	process.exit(1)
}

try {
	const messageSecret = Buffer.from(messageSecretHex, 'hex')
	console.log('messageSecret length:', messageSecret.length, 'bytes')

	// Coba dengan senderJid argumen, atau candidate JIDs
	const candidates = senderJidArg
		? [jidNormalizedUser(senderJidArg)]
		: [
				jidNormalizedUser(data.targetMessageKey.remoteJid),
				// tambahkan JID lain kalau perlu
			]

	let decoded
	let lastErr
	for (const jid of candidates) {
		try {
			decoded = decryptMessageEdit(data, {
				origMsgId: data.targetMessageKey.id,
				origMsgSenderJid: jid,
				editorJid: jid,
				msgEncKey: messageSecret
			})
			console.log('Decrypted with sender:', jid)
			break
		} catch (err) {
			lastErr = err
		}
	}

	if (!decoded) {
		throw lastErr
	}

	console.log('\n=== Decrypted Message ===')
	console.log(JSON.stringify(decoded, null, 2))

	// Kalau isinya bare conversation, wrap jadi protocolMessage
	if (!decoded.protocolMessage) {
		decoded = proto.Message.fromObject({
			protocolMessage: {
				key: data.targetMessageKey,
				type: proto.Message.ProtocolMessage.Type.MESSAGE_EDIT,
				editedMessage: decoded
			}
		})
		console.log('\n=== Wrapped as MESSAGE_EDIT ===')
		console.log(JSON.stringify(decoded, null, 2))
	}
} catch (err) {
	console.error('Decrypt failed:', err.message)
	if (err.message.includes('Unsupported state') || err.message.includes('unable to authenticate')) {
		console.error('=> Auth tag mismatch — wrong messageSecret atau senderJid')
	}
}
