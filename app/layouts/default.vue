<template>
  <div class="flex min-h-dvh bg-bg">
    <AppSidebar />
    <main class="flex min-w-0 max-w-310 flex-1 flex-col gap-6 px-5 pt-14 pb-28 lg:px-8 lg:pt-7 lg:pb-12">
      <slot />
    </main>
    <AppBottomNav />
  </div>
</template>
