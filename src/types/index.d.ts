import type { AxiosRequestConfig } from 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    redirect?: string
    autoDownLoadFile?: boolean
  }
}

declare module 'vue-router' {
  export interface RouteMeta {
    title?: string
  }
}

declare global {

  /**
   * General Object Types.
   */
  type ObjectValueSuite<T = any> = { [key in any]: T }

  /**
   * `error`: Response Status Code.
   *
   * `data`: Response Body.
   *
   * `msg`: Response Message.
   */
  export interface IRequestData {
    error: number
    data: any
    msg: string
    aborted?: boolean
  }

  interface IRequestSuite {
    get(uri: string, params?: ObjectValueSuite, config?: AxiosRequestConfig): Promise<IRequestData>
    post(uri: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestData>
    put(uri: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestData>
    patch(uri: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestData>
    delete(uri: string, config?: AxiosRequestConfig): Promise<IRequestData>
  }

}
export { }
