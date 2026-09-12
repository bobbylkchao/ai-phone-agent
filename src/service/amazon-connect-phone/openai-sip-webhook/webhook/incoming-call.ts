import type { Request, Response } from 'express'
import logger from '@/misc/logger'
import { getErrorMessage } from '@/misc/get-error-message'
import { acceptOpenAiSipCall } from '../handle-call/accept-call'
import type {
  AmazonConnectOpenAiVoiceAgentMetaData,
  RealtimeCallIncomingEvent,
  RealtimeCallIncomingEventSipHeader,
  RealtimeCallIncomingEventSipHeaderName,
  UserToUserInfo,
} from '../types'

const decodeUserToUser = (value: string): UserToUserInfo | null => {
  const trimmed = value.trim()
  const hexPart = trimmed.replace(/;encoding=hex$/i, '').trim()
  if (!hexPart || !/^[0-9a-f]+$/i.test(hexPart)) return null
  try {
    const jsonStr = Buffer.from(hexPart, 'hex').toString('utf8')
    return JSON.parse(jsonStr) as UserToUserInfo
  } catch {
    return null
  }
}

const getSipHeaderValue = (
  sipHeaders: RealtimeCallIncomingEventSipHeader[],
  name: RealtimeCallIncomingEventSipHeaderName
): string | undefined => {
  if (!sipHeaders?.length) return undefined
  return sipHeaders.find((header) => header?.name === name)?.value ?? undefined
}

/** HTTP handler for OpenAI `realtime.call.incoming`. */
export const handleOpenAiSipIncomingCallWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const event = req.body as RealtimeCallIncomingEvent
    if (event?.type !== 'realtime.call.incoming' || !event?.data?.call_id) {
      logger.warn(
        { type: event?.type, callId: event?.data?.call_id },
        '[AmazonConnectPhone] Ignoring webhook (not realtime.call.incoming or missing call_id)'
      )
      res.status(400).json({
        error: 'Expected realtime.call.incoming event with call_id',
      })
      return
    }

    const callId = event.data.call_id
    const amazonConnectSourceArn = getSipHeaderValue(
      event.data.sip_headers,
      'X-Amzn-SourceArn'
    )
    const userToUserRaw = getSipHeaderValue(
      event.data.sip_headers,
      'User-to-User'
    )
    const userToUserData = userToUserRaw
      ? decodeUserToUser(userToUserRaw)
      : null

    logger.info(
      {
        callId,
        contactId: userToUserData?.contactId,
        queueName: userToUserData?.queueName,
      },
      '[AmazonConnectPhone] realtime.call.incoming received'
    )

    // Example User-to-User data from Amazon Connect
    const metaData: AmazonConnectOpenAiVoiceAgentMetaData = {
      amazonConnectSourceArn,
      businessType: userToUserData?.businessType,
      languageCode: userToUserData?.languageCode,
      partnerName: userToUserData?.partnerName,
      contactId: userToUserData?.contactId,
      initialContactId: userToUserData?.initialContactId,
      queueName: userToUserData?.queueName,
      initiationMethod: userToUserData?.initiationMethod,
      customerPhoneNumber: userToUserData?.customerPhoneNumber,
      systemPhoneNumber: userToUserData?.systemPhoneNumber,
    }

    const result = await acceptOpenAiSipCall({ callId, metaData })

    if (result.ok) {
      res.status(200).json({ accepted: true, call_id: callId })
    } else {
      res.status(500).json({
        accepted: false,
        call_id: callId,
        error: result.error,
      })
    }
  } catch (error) {
    const errorDetails = getErrorMessage(
      'handleOpenAiSipIncomingCallWebhook',
      error
    )
    logger.error(
      errorDetails,
      '[AmazonConnectPhone] Error handling OpenAI SIP incoming webhook'
    )
    res.status(500).json({
      accepted: false,
      error: 'Error occurred while handling incoming call',
    })
  }
}
