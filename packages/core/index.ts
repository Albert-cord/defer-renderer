/**
 * core
 *
 * taskManager
 * ----task
 *
 *
 */
import { MinQueue } from 'heapify'

// 教训：有点失败，加上自己状态不太好，第一个是没想好抽象之间的通信、工作方式
// 第二个是自己有点累加上厌倦写代码

/**
 * 先用中文说一遍：
 * 首先每个延迟都是一个Task，Task可以注册管理器自己的执行动作，action
 * 然后可以有当前任务状态: 做没有做，至于action自己做未做完是action自己决定，
 * 也可以拿到内部任务，自己决定执行与否，如果自己先执行，就比管理器自身决定的先执行，如果已经在序列中就管理器中skip
 * 跳过执行有点破坏约定了，不如提高优先级？没错
 * 所以Task也有自己的status idle running success error
 * 还有执行与否：done: boolean
 * 自己的id，一般是anonymous
 * 执行完还要执行一个回调，告知自身执行状态？可以针对状态TaskStatus执行特定的回调，例如前置 后置
 * Task/EventEmit
 * action
 * taskStatus
 * done
 * id
 * priority
 * onTaskStatus
 * getTaskStatus
 *
 * 任务管理器
 * 基于一个Timer，一个Schedule, 一个Manager/EventEmit
 * Manager
 * tasks priorityQueue
 * events
 * eventName: process, taskChange
 *
 * workStatus: idle doing
 * work
 *
 * machineStatus: idle running pause stop
 * machineTimeStamp
 *
 * onWorkStatus
 *
 *
 *
 * Timer 有多种，
 * 可以有这个抽象，但是不会有那么多种，因为原本的计划就是不阻塞主线程，也只会提供这种，其他有需求再说
 * 例如1. raf执行，然后一次执行n个，确定只有这种
 * raf(() => {
 *     action(); // doing sth;
 * })
 *
 * TaskMachine start changeTaskManager
 *
 *
 *
 */

/**
 * status machine:
 * idle -> running <-> pause
 *   |              -> stop
 *   |                   |
 *   |                   |
 *   |--------------------
 *  possible?
 */
enum MachineStatus {
  Idle = 'idle',
  Running = 'running',
  Pause = 'pause',
  Stop = 'stop',
}

interface Task {
  // name?: string;
  id: number
  done: boolean
  action: (() => void) | (() => Promise<void>) | (() => Generator<unknown, unknown, unknown>)
  priority: number
}

enum WorkStatus {
  Idle = 'idle',
  Working = 'working',
}

enum TaskPriority {
  Normal = 0,
  High = 10,
}

// 有必要Sync？保留吧
// Sync, Async, IdleCallback, Raf,
// Timer/Executor
// like schedule library, cooperate distribute cpu/frame time to do task
// maybe internal not userland
// task execute time more long, pause it and then after interact to continue run.
// todolist

// TODO:
// Message

// EventEmitter

// class TaskManager {
//     tasks:
//     constructor() {

//     }
// }

class EventEmit {
  listeners: {
    [key: string]: Array<(args?: unknown) => void>
  }

  constructor() {
    this.listeners = {}
  }

  on(eventName: string, listener: (args?: unknown) => void) {
    this.listeners[eventName] = this.listeners[eventName] || []
    const queue = this.listeners[eventName]
    queue.push(listener)
    return () => this.off(eventName, listener)
  }

  off(eventName: string, listener: (args?: unknown) => void) {
    this.listeners[eventName] = this.listeners[eventName]?.filter(_listener => _listener !== listener)
  }

  fire(eventName: string, args?: unknown) {
    this.listeners[eventName]?.forEach(listener => listener(args))
  }
}

export interface TaskMachinePublic extends Pick<TaskMachine, 'register' | 'unregister' | 'start' | 'pause' | 'resume' | 'stop'> {
  getMachineStatus: () => MachineStatus
}

export default class TaskMachine<T = number> {
  machineStatus: MachineStatus
  worker: TaskWorker<T>
  register: TaskWorker<T>['register']
  unregister: TaskWorker<T>['unregister']
  on: EventEmit['on']
  off: EventEmit['off']
  fire: EventEmit['fire']
  constructor(timer?: TimerInterface<T>, batchSize?: number) {
    this.machineStatus = MachineStatus.Idle
    this.worker = new TaskWorker<T>(timer ?? new Timer() as TimerInterface<T>, {
      batchSize,
    })
    this.register = this.worker.register.bind(this.worker)
    this.unregister = this.worker.unregister.bind(this.worker)
    this.on = this.worker.on.bind(this.worker)
    this.off = this.worker.off.bind(this.worker)
    this.fire = this.worker.fire.bind(this.worker)
  }

  static instance: TaskMachine | null
  static getInstance() {
    if (this.instance)
      return this.instance

    this.instance = new TaskMachine()
    return this.instance
  }

  start() {
    if (this.machineStatus === MachineStatus.Idle) {
      this.machineStatus = MachineStatus.Running
      this.worker.beginWork()
    }
  }

  stop() {
    if (this.machineStatus !== MachineStatus.Idle) {
      this.machineStatus = MachineStatus.Idle
      this.worker.stopWork()
    }
  }

  pause() {
    if (this.machineStatus !== MachineStatus.Idle && this.machineStatus === MachineStatus.Running) {
      this.machineStatus = MachineStatus.Pause
      this.worker.pauseWork()
    }
  }

  resume() {
    if (this.machineStatus !== MachineStatus.Idle && this.machineStatus !== MachineStatus.Running) {
      this.machineStatus = MachineStatus.Running
      this.worker.beginWork()
    }
  }

  changeBatchSize(batchSize?: number) {
    this.worker.changeBatchSize(batchSize)
  }
}

export interface TimerInterface<T> {
  timer: (task: () => void) => T
  cleanup: (id: T) => void
}

// raf 后面可以替换
class Timer implements TimerInterface<number> {
  timer(task: () => void) {
    return window.requestAnimationFrame(() => {
      task()
    })
  }

  cleanup(timerId: number) {
    window.cancelAnimationFrame(timerId)
  }
}

class TaskWorker<T> extends EventEmit {
  workStatus: WorkStatus
  taskMap: Map<number, Task>
  actionKeyMap: Map<Task['action'], number>
  queue: MinQueue
  increaseId: number
  jobTimerId: null | T
  nextTimerId: number | null
  batchSize: number
  timer: TimerInterface<T>
  // eventEmit: EventEmit;
  constructor(timer: TimerInterface<T>, config?: {
    batchSize?: number
  }) {
    super()
    this.workStatus = WorkStatus.Idle
    this.taskMap = new Map()
    this.actionKeyMap = new Map()
    this.queue = new MinQueue(Infinity)
    this.increaseId = 0
    this.jobTimerId = null
    this.nextTimerId = null
    this.batchSize = config?.batchSize ?? 1
    this.timer = timer
  }

  changeBatchSize(batchSize?: number) {
    if (batchSize === undefined || batchSize < 0) {
      // TODO: assert and throw error
    }
    if (batchSize && batchSize !== this.batchSize) {
      this.batchSize = batchSize
      return true
    }
    return false
  }

  next() {
    this.nextTimerId = window.setTimeout(() => {
      this.beginWork()
    })
  }

  makeNewTask(action: Task['action'], priority?: number) {
    const id = this.increaseId++
    const task: Task = {
      id,
      priority: 0 - (priority ?? TaskPriority.Normal),
      action,
      done: false,
    }
    return task
  }

  beginWork() {
    if (this.queue.capacity === 0) {
      // TODO: log
    }
    this.beginWorkImpl()
  }

  // effect, so just only work in commit work
  private getUndoneTask() {
    let needToDoneTaskCount: number = this.batchSize
    const undoneTasks: [number, Task][] = []
    while (needToDoneTaskCount) {
      if (this.queue.capacity === 0)
        break

      const id = this.queue.pop() as number
      const task = this.taskMap.get(id)
      if (task) {
        undoneTasks.push([id, task])
        needToDoneTaskCount--
      }
    }
    return undoneTasks
  }

  // 如果每个action是一个task，那么其实每次都是一个timer一个action，只是每次执行多个timer
  // 那样不是我期望的，因为每次action都可能是一个阻塞的任务
  // 还是一个timer多个task也就是多个action，timer = job
  // 那某个task想取消应该怎么办？
  // 去除action，但是这个job还会执行
  // 如果暂停机器那就是暂停这个
  beginWorkImpl() {
    if (this.workStatus === WorkStatus.Idle) {
      this.workStatus = WorkStatus.Working
      this.fire('workStatusChange', this.workStatus)
      // 如果这几个work有在
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      const timerResult = this.timer.timer(async () => {
        const undoneTasks = this.getUndoneTask()
        // 其实可以只有getTaskId，然后再自己根据TaskId去拿task引用，但是为了一种优先执行可能性，存引用进去比较合适
        await this.commitWork(undoneTasks)
        this.workStatus = WorkStatus.Idle
        this.fire('workStatusChange', this.workStatus)
        this.next()
      })
      this.jobTimerId = timerResult
    }
  }

  private async commitWork(undoneTasks: [number, Task][]) {
    // 其实可以只有getTaskId，然后再自己根据TaskId去拿task引用，但是为了一种优先执行可能性，存引用进去比较合适
    for (const [taskId, task] of undoneTasks) {
      // if task do an effect worker task, that would not be like happening, for worker already has its handle
      const result = task.action()
      // TODO: Promise Like and etc...
      if (['[object Promise]', '[object Generator]'].includes(Object.prototype.toString.call(task)))
        await result

      // 清除可能存在的引用，出于调试的需要，需要如何存储一份? weakMap? 我觉得应该不会存在调试这里的可能
      task.action = () => void 0
      task.done = true
      this.fire('doneTask', taskId)
    }
  }

  pauseWork() {
    this.workStatus = WorkStatus.Idle
    this.fire('workStatusChange', this.workStatus)
    this.jobTimerId && this.timer.cleanup(this.jobTimerId)
    this.nextTimerId && window.clearTimeout(this.nextTimerId)
  }

  stopWork() {
    this.pauseWork()
    this.queue.clear()
    this.taskMap.clear()
    this.actionKeyMap.clear()
    this.listeners = {}
  }

  register(action: Task['action'], priority?: number) {
    const task = this.makeNewTask(action, priority)
    // TODO:
    // priority 是升序还是降序？
    this.queue.push(task.id, task.priority)
    const taskId = task.id
    this.taskMap.set(taskId, task)
    this.actionKeyMap.set(action, taskId)
    this.fire('registerTask', task.id)
    return () => this.unregister(action)
  }

  // 考虑一种场景，如果在
  // 感觉可以去掉removeIfInTaskQueue，感觉没这个场景，如果可见就直接unregister这个task了
  unregister(action: Task['action']) {
    if (this.actionKeyMap.has(action)) {
      const key = this.actionKeyMap.get(action)
      if (key === void 0)
        return
      const task = this.taskMap.get(key)
      // 其实还有一种就是beginWork不拿这个task引用，例如拿个getTask
      // 但是没必要，因为task已经在队列了，到了执行它的时候了，不能篡改queue
      if (task) {
        // 但是调高优先级，把当前的干掉，放到下个队列里也是很扯淡
        // 篡改，修改可能存在Job里的task
        // 调高优先级不一定就是马上执行，如果是马上执行，请自行调用task
        // 所以还是交给taskWork调度
        // if(removeIfInTaskQueue) {
        //     task.action = () => void 0;
        // }
        this.taskMap.delete(key)
        this.actionKeyMap.delete(action)
        this.fire('unregisterTask', task.id)
      }
    }
  }
}
