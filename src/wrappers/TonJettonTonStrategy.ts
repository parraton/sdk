import {
  Address,
  beginCell,
  Builder,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
} from "@ton/core";

export type TonJettonTonStrategyConfig = {
  vaultAddress: Address;
  jettonMasterAddress: Address;
  poolAddress: Address;
  poolType: number;
  depositLpWalletAddress: Address;
  jettonWalletAddress: Address;
  adminAddress: Address;
  jettonVaultAddress: Address;
  nativeVaultAddress: Address;
  tempUpgrade: Cell;
};

export type TjtReinvestParams = {
  amountToSwap: bigint;
  swapLimit: bigint;
  depositLimit: bigint;
  tonTargetBalance: bigint;
  depositFee: bigint;
  depositFwdFee: bigint;
  transferFee: bigint;
  jettonTargetBalance: bigint;
  deadline: number;
};

export interface TonJettonTonStrategyFees {
  transferFee: bigint;
  excessFee: bigint;
  transferNotificationFee: bigint;
  reinvestFee: bigint;
}

export function tonJettonTonStrategyConfigToCell(
  config: TonJettonTonStrategyConfig
): Cell {
  return beginCell()
    .storeAddress(config.vaultAddress)
    .storeAddress(config.jettonMasterAddress)
    .storeAddress(config.poolAddress)
    .storeUint(config.poolType, 1)
    .storeRef(
      beginCell()
        .storeAddress(config.depositLpWalletAddress)
        .storeAddress(config.jettonWalletAddress)
        .storeAddress(config.adminAddress)
        .endCell()
    )
    .storeRef(
      beginCell()
        .storeAddress(config.jettonVaultAddress)
        .storeAddress(config.nativeVaultAddress)
        .endCell()
    )
    .storeRef(config.tempUpgrade)
    .endCell();
}

export class TonJettonTonStrategy implements Contract {
  static readonly OPS = {
    transfer_notification: 0x7362d09c,
    internal_transfer: 0x178d4519,
    reinvest: 0x812d4e3,
    deposit_liquidity: 0xd55e4686,
    cb_fail_swap_or_invest: 0x474f86cf,
    stop_deposit_to_pool: 0x53cd6d4b,
    cb_success_swap: 0x32d0ad4a,
    complete_reinvest: 0x973280f5,
    continue_deposit_to_pool: 0xbbe82bd8,
    init_code_upgrade: 0xdf1e233d,
    init_admin_upgrade: 0x2fb94384,
    finalize_upgrades: 0x6378509f,
    init: 0xc674e474,
    withdraw_jettons: 0x18a9ed91,
    cancel_admin_upgrade: 0xa4ed9981,
    cancel_code_upgrade: 0x357ccc67,
  };

  static readonly EXIT_CODES = {
    WRONG_OP: 80,
    WRONG_WORKCHAIN: 81,
    INVALID_AMOUNT: 82,
    INSUFFICIENT_REWARDS_BALANCE: 83,
    INVALID_JETTON_TOKEN: 84,
    WRONG_VAULT_OP: 85,
    UNKNOWN_TRANSFER_NOTIFICATION: 86,
    WRONG_INIT_OP: 87,
    INVALID_DEADLINE: 88,
    CANT_WITHDRAW_LP: 89,
    CANT_WITHDRAW_JETTON: 90,
    WRONG_ADMIN_OP: 801,
  };

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static unpackTempUpgrade(cell: Cell) {
    const slice = cell.beginParse();
    return {
      endCode: slice.loadUint(64),
      endAdmin: slice.loadUint(64),
      admin: slice.loadAddressAny(),
      code: slice.loadRef(),
    };
  }

  static createFromAddress(address: Address) {
    return new TonJettonTonStrategy(address);
  }

  static createFromConfig(
    config: TonJettonTonStrategyConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = tonJettonTonStrategyConfigToCell(config);
    const init = { code, data };
    return new TonJettonTonStrategy(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendInit(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      depositLpWalletAddress: Address;
      jettonWalletAddress: Address;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.init, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.depositLpWalletAddress)
        .storeAddress(opts.jettonWalletAddress)
        .endCell(),
    });
  }

  packReinvestData(opts: TjtReinvestParams): Builder {
    if (opts.amountToSwap > 0) {
      return beginCell()
        .storeCoins(opts.amountToSwap)
        .storeCoins(opts.swapLimit)
        .storeUint(opts.deadline, 32)
        .storeCoins(opts.tonTargetBalance)
        .storeCoins(opts.jettonTargetBalance)
        .storeCoins(opts.depositFee)
        .storeCoins(opts.depositFwdFee)
        .storeCoins(opts.transferFee)
        .storeRef(beginCell().storeCoins(opts.depositLimit).endCell());
    } else {
      return beginCell()
        .storeCoins(opts.amountToSwap)
        .storeCoins(opts.tonTargetBalance)
        .storeCoins(opts.jettonTargetBalance)
        .storeCoins(opts.depositFee)
        .storeCoins(opts.depositFwdFee)
        .storeCoins(opts.transferFee)
        .storeRef(beginCell().storeCoins(opts.depositLimit).endCell());
    }
  }

  async sendWithdrawJettons(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      walletAddress: Address;
      receiverAddress: Address;
      amount: bigint;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.withdraw_jettons, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.walletAddress)
        .storeAddress(opts.receiverAddress)
        .storeCoins(opts.amount)
        .endCell(),
    });
  }

  async sendReinvest(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      totalReward: bigint;
      amountToSwap: bigint;
      limit: bigint;
      tonTargetBalance: bigint;
      jettonTargetBalance: bigint;
      deadline: number;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.reinvest, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeCoins(opts.totalReward)
        .storeCoins(opts.amountToSwap)
        .storeCoins(opts.limit)
        .storeUint(opts.deadline, 32)
        .storeCoins(opts.tonTargetBalance)
        .storeCoins(opts.jettonTargetBalance)
        .endCell(),
    });
  }

  async getStrategyData(
    provider: ContractProvider
  ): Promise<TonJettonTonStrategyConfig> {
    const result = await provider.get("get_strategy_data", []);
    return {
      vaultAddress: result.stack.readAddress(),
      jettonMasterAddress: result.stack.readAddress(),
      poolAddress: result.stack.readAddress(),
      poolType: result.stack.readNumber(),
      depositLpWalletAddress: result.stack.readAddress(),
      jettonWalletAddress: result.stack.readAddress(),
      adminAddress: result.stack.readAddress(),
      jettonVaultAddress: result.stack.readAddress(),
      nativeVaultAddress: result.stack.readAddress(),
      tempUpgrade: result.stack.readCell(),
    };
  }

  async getStrategyPoolAddress(provider: ContractProvider): Promise<Address> {
    const result = await provider.get("get_strategy_data", []);
    result.stack.readAddress();
    result.stack.readAddress();
    return result.stack.readAddress();
  }

  async sendFinalizeUpgrades(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.finalize_upgrades, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .endCell(),
    });
  }

  async sendInitCodeUpgrade(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      code: Cell;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.init_code_upgrade, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeRef(opts.code)
        .endCell(),
    });
  }

  async sendInitAdminUpgrade(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      admin: Address;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.init_admin_upgrade, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.admin)
        .endCell(),
    });
  }

  async sendCancelAdminUpgrade(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.cancel_admin_upgrade, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .endCell(),
    });
  }

  async sendCancelCodeUpgrade(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: number;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(TonJettonTonStrategy.OPS.cancel_code_upgrade, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .endCell(),
    });
  }
}
