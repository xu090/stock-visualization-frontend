<template>
  <router-view />
</template>

<script>
import { debounce } from 'lodash';

export default {
  name: 'App',
  mounted() {
    const resizeHandler = debounce(() => {
      console.log('窗口尺寸发生变化');
    }, 200);

    // 监听整个文档
    this.resizeObserver = new ResizeObserver(resizeHandler);
    this.resizeObserver.observe(document.body);
  },
  beforeUnmount() {
    // 组件卸载时，断开监听
    this.resizeObserver.disconnect();
  }
}
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
}

.el-drawer {
  z-index: 9999 !important;
}
.tour-popover .driver-popover-title{
  font-weight: 900;
}
.tour-popover .driver-popover-description{
  font-weight: 700;
  line-height: 1.5;
}

</style>
