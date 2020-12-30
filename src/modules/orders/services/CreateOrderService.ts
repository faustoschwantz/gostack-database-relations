import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) throw new AppError('This customer does not exist');

    const findedProducts = await this.productsRepository.findAllById(products);

    if (!findedProducts.length) throw new AppError('No products found');

    if (findedProducts.length !== products.length)
      throw new AppError('Some products were not found');

    const hasProductWithoutQuantity = products.filter(product => {
      return (
        product.quantity >
        findedProducts.filter(({ id }) => id === product.id)[0].quantity
      );
    });
    if (hasProductWithoutQuantity.length)
      throw new AppError('some products without enough quantity');

    const normalizedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: findedProducts.filter(({ id }) => id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: normalizedProducts,
    });

    const { order_products } = order;
    const ordersToUpdateQuantitys = order_products.map(product => ({
      id: product.product_id,
      quantity:
        findedProducts.filter(({ id }) => id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(ordersToUpdateQuantitys);

    return order;
  }
}

export default CreateOrderService;
