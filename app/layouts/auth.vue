<template>
  <div
    class="flex min-h-dvh flex-col items-center gap-6 bg-bg px-4 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2rem)] sm:justify-center"
  >
    <AppLogo :size="36" />
    <main class="w-full max-w-100 rounded-(--radius-card) bg-surface p-6 sm:p-8">
      <slot />
    </main>
    <AuthPreferences class="w-full max-w-100" />
  </div>
</template>
