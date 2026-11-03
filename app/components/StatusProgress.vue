<script setup lang="ts">
defineProps<{ name:string; color:string; count:number; total:number }>()
</script>
<template><div class="progress"><div><span :style="{background:color}"></span><b>{{name}}</b><small>{{count}}</small></div><i><em :style="{width:`${total?count/total*100:0}%`,background:color}"></em></i></div></template>
<style scoped>.progress{display:grid;gap:6px;margin:12px 0}.progress>div{display:flex;gap:7px;align-items:center}.progress span{width:8px;height:8px;border-radius:50%}.progress small{margin-left:auto;color:var(--muted)}i{height:6px;background:#eee6d9;border-radius:99px;overflow:hidden}em{display:block;height:100%;border-radius:inherit}</style>
