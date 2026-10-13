<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { useLoginUserStore } from '@/stores/loginUserStore.ts'
import ProfileEditor from './profile/components/ProfileEditor.vue'
import ProfileSummary from './profile/components/ProfileSummary.vue'

const loginUserStore = useLoginUserStore()
</script><template>
  <section class="profile-page">
    <PageHeader eyebrow="PERSONAL SPACE" title="个人信息" description="管理你的平台资料，让 AI 更好地了解你的创作身份。">
      <template #actions><span class="account-status"><i></i>账号正常</span></template>
    </PageHeader>

    <div class="profile-layout">
      <ProfileSummary :user="loginUserStore.loginUser" />

      <ProfileEditor />
    </div>
  </section>
</template>

<style scoped>
.profile-page {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  color: #1f2d3d;
}

.account-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  color: #318866;
  font-size: 12px;
  background: #f0fbf6;
  border: 1px solid #d6f1e4;
  border-radius: 999px;
}

.account-status i {
  width: 7px;
  height: 7px;
  background: #35b77e;
  border-radius: 50%;
}

.profile-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
}

@media (max-width: 760px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}</style>
