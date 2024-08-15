import { initBackButton } from '@telegram-apps/sdk';

import { createHOCs } from '../createHOCs';
import { createHooks } from '../createHooks.js';

export const [useBackButtonRaw, useBackButton] = createHooks(initBackButton);

export const [withBackButtonRaw, withBackButton] = createHOCs(
  useBackButtonRaw,
  useBackButton,
);