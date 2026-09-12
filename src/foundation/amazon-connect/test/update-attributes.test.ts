import type { UpdateContactAttributesCommand } from '@aws-sdk/client-connect'
import { updateContactAttributes } from '../update-attributes'

let mockClient: { send: jest.Mock } | undefined

jest.mock('../client', () => ({
  get amazonConnectClient() {
    return mockClient
  },
}))

describe('updateContactAttributes', () => {
  const originalInstanceId = process.env.AMAZON_CONNECT_INSTANCE_ID
  const send = jest.fn()

  beforeEach(() => {
    mockClient = { send }
  })

  afterEach(() => {
    if (originalInstanceId === undefined) {
      delete process.env.AMAZON_CONNECT_INSTANCE_ID
    } else {
      process.env.AMAZON_CONNECT_INSTANCE_ID = originalInstanceId
    }
  })

  it('sends the attributes to the initial contact', async () => {
    process.env.AMAZON_CONNECT_INSTANCE_ID = 'instance-1'
    send.mockResolvedValueOnce({})

    await updateContactAttributes('contact-1', { Handoff: 'true' })

    expect(send).toHaveBeenCalledTimes(1)
    const command = send.mock.calls[0][0] as UpdateContactAttributesCommand
    expect(command.input).toEqual({
      InstanceId: 'instance-1',
      InitialContactId: 'contact-1',
      Attributes: { Handoff: 'true' },
    })
  })

  it('skips the AWS call when the SDK client was never initialized', async () => {
    mockClient = undefined

    await expect(
      updateContactAttributes('contact-1', { Handoff: 'true' })
    ).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
  })

  it('absorbs configuration and SDK request failures', async () => {
    delete process.env.AMAZON_CONNECT_INSTANCE_ID
    await expect(
      updateContactAttributes('contact-1', {})
    ).resolves.toBeUndefined()

    process.env.AMAZON_CONNECT_INSTANCE_ID = 'instance-1'
    send.mockRejectedValueOnce(new Error('AWS unavailable'))
    await expect(
      updateContactAttributes('contact-1', {})
    ).resolves.toBeUndefined()
  })
})
