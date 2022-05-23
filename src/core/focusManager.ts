import { Subscribable } from "./subscribable";

class FocusManager extends Subscribable {
  private focused?: boolean
  private removeEventListener?: () => void

  protected onSubscribe(): void {
    if (!this.removeEventListener) {
      this.setDefaultEventListener();
    }
  }

  setEventListener(
    setup: (setFocused: (focused?: boolean) => void) => () => void
  ): void {
    if (this.removeEventListener) {
      this.removeEventListener()
    }
    this.removeEventListener = setup(focused => {
      if (typeof focused === 'boolean') {
        this.setFocused(focused);
      } else {
        this.onFocus();
      }
    })
  }

  setFocused(focused?: boolean): void {
    this.focused = focused;

    if (focused) {
      this.onFocus();
    }
  }

  onFocus(): void {
    this.listeners.forEach(listener => {
      listener();
    })
  }

  isFocused(): boolean {
    if (typeof this.focused === 'boolean') {
      return this.focused
    }

    return [undefined, 'visible', 'prerender'].includes(
      document.visibilityState
    )
  }

  private setDefaultEventListener() {
    if (window?.addEventListener) {
      this.setEventListener(onFocus => {
        const listener = () => onFocus()

        window.addEventListener('visibilitychange', listener, false)
        window.addEventListener('focus', listener, false)

        return () => {
          window.removeEventListener('visibilitychange', listener)
          window.removeEventListener('focus', listener)
        }
      })
    }
  }
}

export const focusManager = new FocusManager()