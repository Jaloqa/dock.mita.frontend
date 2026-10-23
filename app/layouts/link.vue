<template>
  <div class="flex min-h-dvh flex-col bg-bg">
    <header
      class="mx-auto flex w-full max-w-310 items-center px-5 pt-[max(env(safe-area-inset-top),1.5rem)] lg:px-8 lg:pt-7"
    >
      <AppLogo :size="32" />
    </header>
    <main class="mx-auto flex w-full max-w-310 flex-1 flex-col gap-6 px-5 py-6 lg:px-8">
      <slot />
    </main>
    <footer class="mx-auto w-full max-w-310 px-5 pb-[max(env(safe-area-inset-bottom),2rem)] lg:px-8">
      <AuthPreferences class="w-full max-w-100" />
    </footer>
  </div>
</template>
