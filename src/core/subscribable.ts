type Listener = () => void;

export class Subscribable<TListener extends Function = Listener> {
  protected listeners: TListener[]

  constructor() {
    this.listeners = []
  }

  subscribe(listener?: TListener): () => void {
    const callback = listener || (() => undefined);

    this.listeners.push(callback as TListener);

    this.onSubscribe();

    // 返回取消订阅函数
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
      this.onUnsubscribe();
    }
  }

  hasListeners(): boolean {
    return this.listeners.length > 0
  }

  protected onSubscribe(): void {
    // remain to be filled by subclass
  }

  protected onUnsubscribe(): void {
    // remain to be filled by subclass
  }
}