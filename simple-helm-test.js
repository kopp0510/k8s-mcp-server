/**
 * 簡化的 Helm 測試
 */

import { HelmListTool } from './src/tools/helm-list.js';

async function testHelmList() {
  console.log('測試 helm_list 工具...\n');

  const tool = new HelmListTool();

  try {
    console.log('執行 helm_list...');
    const result = await tool.execute({});

    if (result && result.content && result.content[0] && result.content[0].text) {
      console.log('✅ 成功！');
      console.log('輸出:');
      console.log(result.content[0].text);
    } else {
      console.log('❌ 結果格式錯誤:', result);
    }

  } catch (error) {
    console.log('❌ 錯誤:', error.message);
  }
}

testHelmList().catch(console.error);