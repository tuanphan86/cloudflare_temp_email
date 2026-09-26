<script setup>
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { User, ExchangeAlt, Copy } from '@vicons/fa'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import Login from '../common/Login.vue'
import TelegramAddress from './TelegramAddress.vue'
import LocalAddress from './LocalAddress.vue'
import AddressManagement from '../user/AddressManagement.vue'
import { getRouterPathWithLang } from '../../utils'
import AddressSelect from '../../components/AddressSelect.vue'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'

const router = useRouter()

const {
    jwt,
    settings,
    showAddressCredential,
    userJwt,
    isTelegram,
    addressPassword
} = useGlobalState()

const { locale, t } = useScopedI18n('views.index.AddressBar')

const showAddressManage = ref(false)

const onUserLogin = async () => {
    await router.push(
        getRouterPathWithLang('/user', locale.value)
    )
}

const copyAddress = async () => {
    if (!settings.value?.address) return

    try {
        await navigator.clipboard.writeText(
            settings.value.address
        )
    } catch (error) {
        console.error('Copy failed', error)
    }
}

const loadMailbox = async () => {
    await api.getSettings()
}

const openRandomAddress = () => {
    showAddressManage.value = true
}

onMounted(async () => {
    await api.getSettings()
})
</script>


<template>

    <div class="viewer-address-root">

        <!-- ================================= -->
        <!-- LOADING -->
        <!-- ================================= -->

        <div
            v-if="!settings.fetched"
            class="viewer-control-card"
        >

            <n-skeleton
                height="44px"
                width="100%"
            />

        </div>


        <!-- ================================= -->
        <!-- ACTIVE MAILBOX -->
        <!-- ================================= -->

        <div
            v-else-if="settings.address"
            class="viewer-control-card"
        >

            <div class="viewer-control-row">


                <!-- EMAIL ADDRESS -->

                <div class="viewer-address-input">

                    <AddressSelect />

                </div>


                <!-- LOAD -->

                <n-button
                    class="viewer-button viewer-load-button"
                    @click="loadMailbox"
                >

                    Load

                </n-button>


                <!-- RANDOM -->

                <n-button
                    class="viewer-button"
                    @click="openRandomAddress"
                >

                    Random

                </n-button>


                <!-- COPY -->

                <n-button
                    class="viewer-button"
                    @click="copyAddress"
                >

                    <template #icon>

                        <n-icon :component="Copy" />

                    </template>

                    Copy

                </n-button>

            </div>

        </div>


        <!-- ================================= -->
        <!-- TELEGRAM -->
        <!-- ================================= -->

        <div
            v-else-if="isTelegram"
            class="viewer-login-card"
        >

            <TelegramAddress />

        </div>


        <!-- ================================= -->
        <!-- USER ADDRESS MANAGEMENT -->
        <!-- ================================= -->

        <div
            v-else-if="userJwt"
            class="viewer-login-card"
        >

            <AddressManagement />

        </div>


        <!-- ================================= -->
        <!-- NO MAILBOX -->
        <!-- ================================= -->

        <div
            v-else
            class="viewer-login-card"
        >

            <Login />

            <div class="viewer-user-center">

                <n-button
                    @click="onUserLogin"
                    secondary
                    strong
                    block
                >

                    <template #icon>

                        <n-icon :component="User" />

                    </template>

                    {{ t('userCenter') }}

                </n-button>

            </div>

        </div>


        <!-- ================================= -->
        <!-- CREDENTIAL -->
        <!-- ================================= -->

        <AddressCredentialModal
            v-model:show="showAddressCredential"
            :address="settings.address"
            :jwt="jwt"
            :address-password="addressPassword"
        />


        <!-- ================================= -->
        <!-- RANDOM / ADDRESS MANAGEMENT -->
        <!-- ================================= -->

        <n-modal
            v-model:show="showAddressManage"
            preset="card"
            title="Mailbox Management"
            class="viewer-management-modal"
            style="width: 720px; max-width: calc(100vw - 32px);"
        >

            <TelegramAddress
                v-if="isTelegram"
            />

            <AddressManagement
                v-else-if="userJwt"
            />

            <LocalAddress
                v-else
            />

        </n-modal>

    </div>

</template>


<style scoped>

/* ========================================= */
/* ROOT */
/* ========================================= */

.viewer-address-root {
    width: 100%;
}


/* ========================================= */
/* MAIN CONTROL CARD */
/* ========================================= */

.viewer-control-card {
    width: 100%;

    box-sizing: border-box;

    padding: 20px 24px;

    background: #151922;

    border:
        1px solid #2c3442;

    border-radius:
        12px;

    box-shadow:
        0 18px 45px rgba(0, 0, 0, 0.18);
}


/* ========================================= */
/* CONTROL ROW */
/* ========================================= */

.viewer-control-row {
    display: flex;

    align-items: center;

    gap: 12px;

    width: 100%;
}


/* ========================================= */
/* ADDRESS */
/* ========================================= */

.viewer-address-input {
    flex:
        1 1 auto;

    min-width: 0;
}


/*
AddressSelect internally uses Naive UI.
Force it to match reference UI.
*/

.viewer-address-input :deep(.n-base-selection) {
    min-height: 44px;

    background:
        #0c1017 !important;

    border-radius:
        8px;
}


.viewer-address-input :deep(.n-base-selection-label) {
    background:
        #0c1017 !important;

    color:
        #dce5f2 !important;
}


.viewer-address-input :deep(.n-base-selection-input) {
    color:
        #dce5f2 !important;
}


.viewer-address-input :deep(.n-base-selection-placeholder) {
    color:
        #798499 !important;
}


/* ========================================= */
/* BUTTONS */
/* ========================================= */

.viewer-button {
    height: 44px;

    min-width: 88px;

    padding:
        0 20px;

    border-radius:
        8px;

    font-weight:
        600;

    color:
        #e6edf7;

    background:
        #1c2230;

    border:
        1px solid #2b3445;
}


.viewer-button:hover {
    color:
        #ffffff;

    background:
        #252d3c;

    border-color:
        #3a4559;
}


/* LOAD = CYAN */

.viewer-load-button {
    color:
        #071512 !important;

    background:
        #10d6bd !important;

    border-color:
        #10d6bd !important;
}


.viewer-load-button:hover {
    background:
        #20e3c9 !important;

    border-color:
        #20e3c9 !important;
}


/* ========================================= */
/* LOGIN STATE */
/* ========================================= */

.viewer-login-card {
    width: 100%;

    box-sizing: border-box;

    padding: 24px;

    background:
        #151922;

    border:
        1px solid #2c3442;

    border-radius:
        12px;
}


.viewer-user-center {
    margin-top:
        16px;
}


/* ========================================= */
/* RESPONSIVE */
/* ========================================= */

@media (max-width: 720px) {

    .viewer-control-card {
        padding:
            14px;
    }


    .viewer-control-row {
        flex-wrap:
            wrap;
    }


    .viewer-address-input {
        flex:
            1 1 100%;

        width:
            100%;
    }


    .viewer-button {
        flex:
            1 1 0;

        min-width:
            0;

        padding:
            0 10px;
    }

}


@media (max-width: 420px) {

    .viewer-button {
        font-size:
            12px;
    }

}

</style>
