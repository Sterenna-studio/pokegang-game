'use strict';

import { renderEventsTab } from './pcPokedex.js';

function renderBattleLogTab() {
  return renderEventsTab();
}

Object.assign(globalThis, { renderBattleLogTab });
export { renderBattleLogTab };
