// Types
type NotifyCallbcak = () => void
type NotifyFunction = (callback: () => void) => void
type BatchNotifyFunction = (callback: () => void) => void

/**
 * With this resolvedPromise & currentFlushingPromise
 * Jobs queued when flushing can be processed earlier
 *  */ 
const resolvedPromise = Promise.resolve()
let currentFlushingPromise: Promise<void> | null = null

export class NotifyManager {
  private queue: NotifyCallbcak[]
  private transactions: number
  private notifyFn: NotifyFunction
  private batchNotifyFn: BatchNotifyFunction

  constructor() {
    this.queue = []
    this.transactions = 0

    this.notifyFn = (callback: () => void) => {
      callback()
    }

    this.batchNotifyFn = (callback: () => void) => {
      callback()
    }
  }

  /**
   * 批处理
   * 即刻执行一个任务
   * 并将队列中所有任务加入下一轮执行，清空队伍
   *  */ 
  batch<T>(callback: () => T): T {
    this.transactions++
    const result = callback()
    this.transactions--
    // if pending, flush
    if (!this.transactions) {
      this.flush()
    }
    return result
  }

  flush(): void {
    const queue = this.queue
    // clean queue
    this.queue = []
    if (queue.length) {
      // put queue Cbs into microTask Queue
      currentFlushingPromise = resolvedPromise.then(() => {
        try {
          this.batchNotifyFn(() => {
            queue.forEach(callback => {
              this.notifyFn(callback)
            })
          })
        } finally {
          currentFlushingPromise = null
        }
      })
    }
  }

  /**
   * 将任务入队
   *  */
  schedule(callback: NotifyCallbcak): void {
    if (this.transactions) {
      this.queue.push(callback)
    } else {
      scheduleMicrotask(() => {
        this.notifyFn(callback)
      })
    }
  }

  batchCalls<T extends Function>(callback: T): T {
    return ((...args: any[]) => {
      this.schedule(() => {
        callback(...args)
      })
    }) as any
  }

  setNotifyFunction(fn: NotifyFunction) {
    this.notifyFn = fn
  }

  setBatchNotifyFunction(fn: BatchNotifyFunction) {
    this.batchNotifyFn = fn
  }
}

export function scheduleMicrotask<T = void>(
  callback: () => void,
  context?: T,
): void {
  const p = currentFlushingPromise || resolvedPromise
  resolvedPromise
    .then(context ? callback.bind(context) : callback)
    .catch(error => {
      setTimeout(() => {
        throw error
      });
    })
}

// 单例模式
export const notifyManager = new NotifyManager()