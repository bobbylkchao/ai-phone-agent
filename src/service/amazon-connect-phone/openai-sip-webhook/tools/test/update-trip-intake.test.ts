import { deleteCall, getTripIntake } from '../../call-store'
import { updateTripIntakeTool } from '../update-trip-intake'

describe('update_trip_intake tool', () => {
  afterEach(() => {
    deleteCall('call-1')
  })

  it('merges each field it receives into the call intake', async () => {
    await updateTripIntakeTool.execute('call-1', { customerName: 'Ada' })
    await updateTripIntakeTool.execute('call-1', {
      tripRequirementsNotes: 'Tokyo in May',
    })

    expect(getTripIntake('call-1')).toEqual({
      customerName: 'Ada',
      tripRequirementsNotes: 'Tokyo in May',
    })
  })

  it('accepts a missing payload', async () => {
    await updateTripIntakeTool.execute('call-1', undefined)

    expect(getTripIntake('call-1')).toEqual({})
  })

  it('rejects fields with the wrong type', async () => {
    await expect(
      updateTripIntakeTool.execute('call-1', { customerName: 123 })
    ).rejects.toThrow()
  })

  it('publishes a JSON schema that matches the Zod schema', () => {
    expect(updateTripIntakeTool.parametersJsonSchema).toMatchObject({
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        tripRequirementsNotes: { type: 'string' },
      },
      additionalProperties: false,
    })
  })
})
