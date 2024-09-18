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

export type JettonJettonTonStrategyConfig = {
  vaultAddress: Address;
  jettonMasterAddress: Address;
  poolAddress: Address;
  poolType: number;
  usdtMasterAddress: Address;
  depositLpWalletAddress: Address;
  adminAddress: Address;
  usdtVaultAddress: Address;
  jettonVaultAddress: Address;
  nativeVaultAddress: Address;
  usdtWalletAddress: Address;
  jettonWalletAddress: Address;
  usdtTonPoolAddress: Address;
  tempUpgrade: Cell;
};

export type JjtReinvestParams = {
  amountToSwap0?: bigint;
  amountToSwap1?: bigint;
  swap0Limit?: bigint;
  swap1Limit?: bigint;
  swapFwdFee?: bigint;
  depositLimit: bigint;
  usdtTargetBalance: bigint;
  jettonTargetBalance: bigint;
  depositFee: bigint;
  depositFwdFee: bigint;
  transferFee: bigint;
  deadline?: number;
};

export interface JettonJettonTonStrategyFees {
  transferFee: bigint;
  excessFee: bigint;
  transferNotificationFee: bigint;
  reinvestFee: bigint;
}

export function jettonJettonTonStrategyConfigToCell(
  config: JettonJettonTonStrategyConfig
): Cell {
  return beginCell()
    .storeAddress(config.vaultAddress)
    .storeAddress(config.jettonMasterAddress)
    .storeAddress(config.poolAddress)
    .storeUint(config.poolType, 1)
    .storeRef(
      beginCell()
        .storeAddress(config.usdtMasterAddress)
        .storeAddress(config.depositLpWalletAddress)
        .storeAddress(config.adminAddress)
        .endCell()
    )
    .storeRef(
      beginCell()
        .storeAddress(config.usdtVaultAddress)
        .storeAddress(config.jettonVaultAddress)
        .storeAddress(config.nativeVaultAddress)
        .endCell()
    )
    .storeRef(
      beginCell()
        .storeAddress(config.usdtWalletAddress)
        .storeAddress(config.jettonWalletAddress)
        .storeAddress(config.usdtTonPoolAddress)
        .endCell()
    )
    .storeRef(config.tempUpgrade)
    .endCell();
}

export class JettonJettonTonStrategy implements Contract {
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

  packReinvestData(opts: JjtReinvestParams): Builder {
    const builder = beginCell();
    builder.storeMaybeRef(
      opts.amountToSwap0 && opts.deadline
        ? beginCell()
            .storeCoins(opts.amountToSwap0)
            .storeCoins(opts.swap0Limit || 0n)
            .storeUint(opts.deadline, 32)
            .endCell()
        : null
    );

    builder.storeMaybeRef(
      opts.amountToSwap1 && opts.deadline && opts.swapFwdFee
        ? beginCell()
            .storeCoins(opts.amountToSwap1)
            .storeCoins(opts.swap1Limit || 0n)
            .storeUint(opts.deadline, 32)
            .storeCoins(opts.swapFwdFee)
            .endCell()
        : null
    );

    builder.storeRef(
      beginCell()
        .storeCoins(opts.usdtTargetBalance)
        .storeCoins(opts.jettonTargetBalance)
        .storeCoins(opts.depositFee)
        .storeCoins(opts.depositFwdFee)
        .storeCoins(opts.transferFee)
        .storeCoins(opts.depositLimit)
        .endCell()
    );
    return builder;
  }

  static createFromAddress(address: Address) {
    return new JettonJettonTonStrategy(address);
  }

  static createFromConfig(
    config: JettonJettonTonStrategyConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = jettonJettonTonStrategyConfigToCell(config);
    const init = { code, data };
    return new JettonJettonTonStrategy(contractAddress(workchain, init), init);
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
        .storeUint(JettonJettonTonStrategy.OPS.init, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .storeAddress(opts.depositLpWalletAddress)
        .storeAddress(opts.jettonWalletAddress)
        .endCell(),
    });
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
        .storeUint(JettonJettonTonStrategy.OPS.withdraw_jettons, 32)
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
        .storeUint(JettonJettonTonStrategy.OPS.reinvest, 32)
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

  async getStrategyPoolAddress(provider: ContractProvider): Promise<Address> {
    const result = await provider.get("get_strategy_data", []);
    result.stack.readAddress();
    result.stack.readAddress();
    return result.stack.readAddress();
  }

  async getStrategyData(
    provider: ContractProvider
  ): Promise<JettonJettonTonStrategyConfig> {
    const result = await provider.get("get_strategy_data", []);
    return {
      vaultAddress: result.stack.readAddress(),
      jettonMasterAddress: result.stack.readAddress(),
      poolAddress: result.stack.readAddress(),
      poolType: result.stack.readNumber(),
      usdtMasterAddress: result.stack.readAddress(),
      depositLpWalletAddress: result.stack.readAddress(),
      adminAddress: result.stack.readAddress(),
      usdtVaultAddress: result.stack.readAddress(),
      jettonVaultAddress: result.stack.readAddress(),
      nativeVaultAddress: result.stack.readAddress(),
      usdtWalletAddress: result.stack.readAddress(),
      jettonWalletAddress: result.stack.readAddress(),
      usdtTonPoolAddress: result.stack.readAddress(),
      tempUpgrade: result.stack.readCell(),
    };
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
        .storeUint(JettonJettonTonStrategy.OPS.finalize_upgrades, 32)
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
        .storeUint(JettonJettonTonStrategy.OPS.init_code_upgrade, 32)
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
        .storeUint(JettonJettonTonStrategy.OPS.init_admin_upgrade, 32)
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
        .storeUint(JettonJettonTonStrategy.OPS.cancel_admin_upgrade, 32)
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
        .storeUint(JettonJettonTonStrategy.OPS.cancel_code_upgrade, 32)
        .storeUint(opts.queryId ?? 0, 64)
        .endCell(),
    });
  }
}
