export interface ActionState {
  jumpPressed: boolean;
  boostDown: boolean;
  pausePressed: boolean;
}

export const EMPTY_ACTIONS: ActionState = {
  jumpPressed: false,
  boostDown: false,
  pausePressed: false
};
