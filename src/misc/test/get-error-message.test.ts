import { getErrorMessage } from '../get-error-message'

describe('getErrorMessage', () => {
  it('keeps the message and stack of a real Error', () => {
    const error = new Error('boom')

    expect(getErrorMessage('unit', error)).toMatchObject({
      from: 'unit',
      errorMessage: 'boom',
      errorStack: expect.stringContaining('Error: boom') as string,
    })
  })

  it('stringifies non-Error values and omits the stack', () => {
    expect(getErrorMessage('unit', 42)).toEqual({
      from: 'unit',
      errorMessage: '42',
      errorStack: undefined,
    })
  })
})
