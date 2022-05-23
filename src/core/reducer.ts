export interface Reducer {
  <TState, TAction>(state: TState, action: TAction): TState
}
