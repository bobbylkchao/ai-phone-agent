import pino from 'pino'

jest.unmock('@/misc/logger')
jest.mock('pino', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const loadLogger = (): unknown => {
  let logger: unknown
  jest.isolateModules(() => {
    logger = jest.requireActual<typeof import('../logger')>('../logger').default
  })
  return logger
}

describe('logger configuration', () => {
  const originalLogLevel = process.env.LOG_LEVEL

  afterEach(() => {
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL
    } else {
      process.env.LOG_LEVEL = originalLogLevel
    }
  })

  it('uses readable info-level output by default', () => {
    delete process.env.LOG_LEVEL
    const logger = { info: jest.fn() }
    jest.mocked(pino).mockReturnValueOnce(logger as never)

    expect(loadLogger()).toBe(logger)
    expect(pino).toHaveBeenCalledWith({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    })
  })

  it('honors LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'debug'
    jest.mocked(pino).mockReturnValueOnce({} as never)

    loadLogger()

    expect(pino).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'debug' })
    )
  })
})
