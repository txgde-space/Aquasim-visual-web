<script setup>
</script>

<template>
  <div class="app-shell">
    <header class="app-nav">
      <router-link class="app-brand" to="/">Aquasim</router-link>
      <nav class="app-links">
        <router-link to="/">实验</router-link>
        <router-link to="/replay">回放</router-link>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>
