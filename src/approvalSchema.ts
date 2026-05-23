import { Schema } from './types';

export const approvalSchema: Schema = {
  "systemName": "MJ审批",
  "commonFields": [
    "状态",
    "审批状态",
    "发起人",
    "创建时间",
    "发起时间",
    "操作"
  ],
  "modules": [
    {
      "name": "班列",
      "approvalTypes": [
        {
          "name": "班列供应商变更",
          "businessFields": [
            "班列名称",
            "发车日期",
            "修改后供应商",
            "修改后服务模式"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "任务",
      "approvalTypes": [
        {
          "name": "线路询价",
          "businessFields": [
            "申请班列"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "任务单费用",
          "businessFields": [
            "订单号",
            "任务单类型",
            "任务单编号",
            "费用类型",
            "标准价格",
            "填写价格",
            "附件"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "资金",
      "approvalTypes": [
        {
          "name": "收入变更",
          "businessFields": [
            "订单号",
            "箱号",
            "费用类型",
            "客户",
            "修改前",
            "修改后"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "成本变更",
          "businessFields": [
            "订单号",
            "箱号",
            "费用类型",
            "供应商",
            "修改前",
            "修改后"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "批量删除",
          "businessFields": [
            "收支类型",
            "明细"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "汇率转换",
          "businessFields": [
            "变更前币别",
            "变更后币别",
            "汇率",
            "资金明细"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "付款申请",
          "businessFields": [
            "付款对象",
            "供应商/客户",
            "业务明细",
            "账单"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "付款申请（线下）",
          "businessFields": [
            "收款单位",
            "审批单号",
            "付款金额"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "备用金申请（线下）",
          "businessFields": [
            "收款单位",
            "审批单号",
            "付款金额"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "报销（线下）",
          "businessFields": [
            "收款单位",
            "审批单号",
            "付款金额"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "预付申请",
          "businessFields": [
            "供应商",
            "业务明细",
            "预付账单编号"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "转风控",
          "businessFields": [
            "客户",
            "明细"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "批量修改",
          "businessFields": [
            "收支类型",
            "明细"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "营销折扣",
          "businessFields": [
            "客户",
            "订单号",
            "箱号"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "资金减免",
          "businessFields": [
            "收支类型",
            "减免原因",
            "明细"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "特价审批",
          "businessFields": [
            "始发地（站点/国家区域）",
            "口岸",
            "目的地（站点/国家区域）",
            "箱型",
            "线路类型",
            "申请利润"
          ],
          "commonFields": [
            "审批状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "利润审批",
          "businessFields": [
            "订单号",
            "客户",
            "箱号"
          ],
          "commonFields": [
            "审批状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "客户",
      "approvalTypes": [
        {
          "name": "客户授权",
          "businessFields": [
            "客户",
            "公司名称",
            "授权期限",
            "所属公司",
            "授权类型"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "资质授权",
          "businessFields": [
            "公司名称",
            "审批事项"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "全程指定供应商",
          "businessFields": [
            "客户",
            "公司名称",
            "申请线路"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "客户信息",
          "businessFields": [
            "客户简称",
            "客户全称",
            "客户编号",
            "审批类型",
            "修改后内容"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "无合同校验",
          "businessFields": [
            "校验场景",
            "操作对象",
            "内容"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "资质审查",
          "businessFields": [
            "客户简称",
            "客户全称",
            "地域类型",
            "投保中信保",
            "说明",
            "附件"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "供应商",
      "approvalTypes": [
        {
          "name": "报价",
          "businessFields": [
            "供应商",
            "服务",
            "生效日期描述",
            "报价信息"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "询价",
          "businessFields": [
            "供应商",
            "服务"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "供应商信息",
          "businessFields": [
            "供应商简称",
            "供应商全称",
            "供应商编号",
            "审批类型",
            "内容"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "无合同校验",
          "businessFields": [
            "校验场景",
            "操作对象",
            "内容"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "供应商授权",
          "businessFields": [
            "供应商简称",
            "供应商全称",
            "供应商编号",
            "授权期限"
          ],
          "commonFields": [
            "审批状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "订单",
      "approvalTypes": [
        {
          "name": "项目货变更",
          "businessFields": [
            "订单号",
            "变更为"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        },
        {
          "name": "订单改签",
          "businessFields": [
            "订单号",
            "箱号",
            "变更内容",
            "运费申请"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "退运申请",
          "businessFields": [
            "订单号",
            "箱号"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "提柜",
      "approvalTypes": [
        {
          "name": "用箱需求",
          "businessFields": [
            "提箱点",
            "还箱点",
            "预计提箱日期",
            "箱型箱量"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "发起时间",
            "操作"
          ]
        }
      ]
    },
    {
      "name": "子账号",
      "approvalTypes": [
        {
          "name": "账号管理",
          "businessFields": [
            "部门-职位",
            "用户名",
            "角色",
            "真实姓名",
            "手机号",
            "昵称",
            "动作"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        },
        {
          "name": "权限申请",
          "businessFields": [
            "部门",
            "职位",
            "角色",
            "申请权限"
          ],
          "commonFields": [
            "状态",
            "发起人",
            "创建时间",
            "操作"
          ]
        }
      ]
    }
  ]
};

export function replaceApprovalSchema(nextSchema: Schema, options: { notify?: boolean } = {}) {
  approvalSchema.systemName = nextSchema.systemName;
  approvalSchema.commonFields = nextSchema.commonFields;
  approvalSchema.modules = nextSchema.modules;
  if (options.notify !== false && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('approval-schema-updated'));
  }
}
