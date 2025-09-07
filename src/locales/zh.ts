import { NLPLanguageConfig } from './types';

/**
 * Chinese language configuration for Natural Language Processing
 * Translated patterns for Chinese-speaking users
 */
export const zhConfig: NLPLanguageConfig = {
    code: 'zh',
    name: '中文',
    chronoLocale: 'zh', // chrono-node has Chinese support
    
    dateTriggers: {
        due: ['截止', '到期', '期限', '在', '之前'],
        scheduled: ['安排在', '计划在', '开始在', '在']
    },
    
    recurrence: {
        frequencies: {
            daily: ['每天', '每日', '天天', '日常'],
            weekly: ['每周', '每星期', '周周'],
            monthly: ['每月', '每个月', '月月'],
            yearly: ['每年', '年年', '每一年']
        },
        
        every: ['每', '每个', '每一个'],
        other: ['其他', '另一个'],
        
        weekdays: {
            monday: ['周一', '星期一', '礼拜一'],
            tuesday: ['周二', '星期二', '礼拜二'],
            wednesday: ['周三', '星期三', '礼拜三'],
            thursday: ['周四', '星期四', '礼拜四'],
            friday: ['周五', '星期五', '礼拜五'],
            saturday: ['周六', '星期六', '礼拜六'],
            sunday: ['周日', '星期日', '礼拜日']
        },
        
        pluralWeekdays: {
            monday: ['周一', '星期一', '礼拜一'],
            tuesday: ['周二', '星期二', '礼拜二'],
            wednesday: ['周三', '星期三', '礼拜三'],
            thursday: ['周四', '星期四', '礼拜四'],
            friday: ['周五', '星期五', '礼拜五'],
            saturday: ['周六', '星期六', '礼拜六'],
            sunday: ['周日', '星期日', '礼拜日']
        },
        
        ordinals: {
            first: ['第一个', '第一', '首个'],
            second: ['第二个', '第二'],
            third: ['第三个', '第三'],
            fourth: ['第四个', '第四'],
            last: ['最后一个', '最后', '末尾']
        },
        
        periods: {
            day: ['天', '日'],
            week: ['周', '星期', '礼拜'],
            month: ['月', '个月'],
            year: ['年']
        }
    },
    
    timeEstimate: {
        hours: ['小时', '时', '个小时'],
        minutes: ['分钟', '分', '个分钟']
    },
    
    fallbackStatus: {
        open: ['待办', '未完成', '开放', '新建'],
        inProgress: ['进行中', '正在处理', '处理中', '工作中'],
        done: ['完成', '已完成', '结束', '搞定'],
        cancelled: ['取消', '已取消', '废弃'],
        waiting: ['等待', '暂停', '阻塞', '待定']
    },
    
    fallbackPriority: {
        urgent: ['紧急', '急迫', '立即', '马上'],
        high: ['高', '重要', '优先', '高优先级'],
        normal: ['正常', '普通', '中等', '标准'],
        low: ['低', '不重要', '低优先级', '次要']
    }
};